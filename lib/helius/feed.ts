import 'server-only';

import { randomInt } from 'node:crypto';
import { subMinutes } from 'date-fns';
import { emitGlobalPulseNewTokenAlert } from '@/lib/alerts/generate';
import {
  bundlePulseTokens,
  getTokenByMint,
  listPulseStretchTokens,
  type TokenRow,
  updateToken,
  upsertToken,
} from '@/lib/db/tokens';
import {
  cachedListPulseFeedTokens,
  cachedListRecentTokens,
} from '@/lib/server/cachedPulseTokens';
import type { AppChainId } from '@/lib/chains/appChain';
import { DEFAULT_APP_CHAIN } from '@/lib/chains/appChain';
import { inferMintKind, mintMatchesAppChain } from '@/lib/chains/mintKind';
import { ensureTokenRowFromGeckoEvm } from '@/lib/evm/geckoTerminalPulse';
import type { TablesInsert } from '@/lib/supabase/types';
import {
  listTonApiJettons,
  type TonApiJetton,
  fetchTonApiJettonByMaster,
} from '@/lib/ton/tonApi';
import { tonCenterAddressIsActive } from '@/lib/ton/tonCenter';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';
import { PULSE_THRESHOLDS, type PulseColumnId } from '@/lib/utils/constants';
import type { PulseTokenBundle } from '@/types/tokens';
import { pollGeckoNewPools } from '@/lib/evm/geckoTerminalPulse';
import { ingestLaunchpadDiscovery } from '@/lib/helius/discoveryIngest';
import { launchpadEventFromDasAsset } from '@/lib/helius/parsers';
import { heliusDasRpc, pollSolanaPulseFromDas } from '@/lib/helius/solDasPoll';
import { PublicKey } from '@solana/web3.js';
import type { Asset } from 'helius-sdk/types/das';
import { getHeliusRpcUrl } from '@/lib/utils/constants';

const PULSE_PAGE_SIZE = 60;
const TONAPI_POLL_BATCH = 48;
/** When a column has fewer than this many rows, backfill from TonAPI once. */
const MIN_ROWS_BEFORE_POLL = 6;

const DEBUG_TON = process.env.POINTER_DEBUG_TONAPI === '1';

function debugTon(message: string, extra?: Record<string, unknown>) {
  if (!DEBUG_TON) return;
  if (extra && Object.keys(extra).length > 0) {
    console.log(`[pointer][pulse TON] ${message}`, extra);
  } else {
    console.log(`[pointer][pulse TON] ${message}`);
  }
}

function rawMetadataAddrToMint(metadataAddr: string): string | null {
  return normalizeTonAddress(metadataAddr);
}

function pickSocialFromJetton(j: TonApiJetton): {
  website_url: string | null;
  telegram_url: string | null;
  twitter_handle: string | null;
} {
  const websites = j.metadata?.websites ?? [];
  const social = j.metadata?.social ?? [];
  let telegram_url: string | null = null;
  let twitter_handle: string | null = null;
  for (const s of social) {
    const low = s.toLowerCase();
    if (low.includes('t.me') || low.includes('telegram')) telegram_url = s;
    const xm = s.match(/(?:twitter\.com|x\.com)\/([^/?#]+)/i);
    if (xm?.[1]) twitter_handle = xm[1];
  }
  return {
    website_url: websites[0] ?? null,
    telegram_url,
    twitter_handle,
  };
}

function jettonToTokenRow(j: TonApiJetton, now: string): TablesInsert<'tokens'> | null {
  const mint = rawMetadataAddrToMint(j.metadata?.address ?? '');
  if (!mint) return null;
  if (j.verification === 'blacklist') return null;

  const decimals = Number.parseInt(j.metadata?.decimals ?? '9', 10);
  const adminRaw = j.admin?.address;
  const creator_wallet = adminRaw ? normalizeTonAddress(adminRaw) : null;
  const social = pickSocialFromJetton(j);

  return {
    mint,
    symbol: j.metadata?.symbol ?? '???',
    name: j.metadata?.name ?? 'Unknown Jetton',
    decimals: Number.isFinite(decimals) ? decimals : 9,
    image_url: j.metadata?.image ?? j.preview ?? null,
    description: j.metadata?.description ?? null,
    creator_wallet,
    launch_pad: 'ton',
    raw_metadata: j as unknown as TablesInsert<'tokens'>['raw_metadata'],
    website_url: social.website_url,
    telegram_url: social.telegram_url,
    twitter_handle: social.twitter_handle,
    created_at: now,
    last_seen_at: now,
  };
}

interface IngestOptions {
  source: string;
  alertSource: 'tonapi_poll' | 'tonapi_hydrate';
}

async function ingestTonApiJettons(items: TonApiJetton[], opts: IngestOptions): Promise<number> {
  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  const now = new Date().toISOString();

  for (const j of items) {
    const row = jettonToTokenRow(j, now);
    if (!row) {
      skipped += 1;
      continue;
    }

    const existing = await getTokenByMint(row.mint);
    if (existing) {
      await updateToken(row.mint, {
        last_seen_at: now,
        raw_metadata: row.raw_metadata,
        symbol: row.symbol ?? existing.symbol,
        name: row.name ?? existing.name,
        image_url: row.image_url ?? existing.image_url,
        description: row.description ?? existing.description,
        creator_wallet: row.creator_wallet ?? existing.creator_wallet,
        decimals: row.decimals ?? existing.decimals,
        website_url: row.website_url ?? existing.website_url,
        telegram_url: row.telegram_url ?? existing.telegram_url,
        twitter_handle: row.twitter_handle ?? existing.twitter_handle,
      });
      updated += 1;
    } else {
      await upsertToken(row);
      inserted += 1;
      await emitGlobalPulseNewTokenAlert({
        mint: row.mint,
        symbol: row.symbol,
        name: row.name,
        launchpad: null,
        source: opts.alertSource,
        creator_wallet: row.creator_wallet,
        initial_liquidity_sol: null,
      });
    }
  }

  debugTon(`${opts.source} ingest summary`, {
    inserted,
    updated,
    skipped,
    itemsSeen: items.length,
  });

  return inserted;
}

async function widenChainBackfill(column: PulseColumnId, chain: AppChainId): Promise<TokenRow[]> {
  const recent = await cachedListRecentTokens(1500);
  let pool = recent.filter((t) => mintMatchesAppChain(t.mint, chain));
  if (column === 'new') {
    const since = subMinutes(new Date(), PULSE_THRESHOLDS.newMaxAgeMinutes).toISOString();
    pool = pool.filter((t) => t.created_at >= since);
  } else if (column === 'migrated') {
    pool = pool.filter((t) => t.migrated_at != null);
    pool.sort((a, b) => (b.migrated_at ?? '').localeCompare(a.migrated_at ?? ''));
  } else {
    const stretch = await listPulseStretchTokens(PULSE_PAGE_SIZE * 5);
    const sm = new Set(stretch.map((t) => t.mint));
    pool = pool.filter((t) => sm.has(t.mint));
  }
  pool.sort((a, b) => b.created_at.localeCompare(a.created_at));
  return pool.slice(0, PULSE_PAGE_SIZE);
}

/** Rotate through TonAPI jettons index + a secondary sort key to mimic “pair discovery”. */
export async function pollRecentJettonsFromTonApi(): Promise<number> {
  const offsetA =
    (Math.floor(Date.now() / 300_000) % 40) * TONAPI_POLL_BATCH + randomInt(0, 4);
  const offsetB =
    (Math.floor(Date.now() / 180_000) % 25) * TONAPI_POLL_BATCH + randomInt(0, 8) + 120;

  debugTon('listTonApiJettons(primary offset)', { offset: offsetA, limit: TONAPI_POLL_BATCH });
  const primary = await listTonApiJettons({
    limit: TONAPI_POLL_BATCH,
    offset: offsetA,
  });

  debugTon('listTonApiJettons(secondary offset)', { offset: offsetB, limit: TONAPI_POLL_BATCH });
  const secondary = await listTonApiJettons({
    limit: TONAPI_POLL_BATCH,
    offset: offsetB,
  });

  const byAddr = new Map<string, TonApiJetton>();
  for (const j of [...(primary.jettons ?? []), ...(secondary.jettons ?? [])]) {
    const addr = j.metadata?.address;
    if (!addr) continue;
    if (!byAddr.has(addr)) byAddr.set(addr, j);
  }
  const merged = [...byAddr.values()];

  return ingestTonApiJettons(merged, {
    source: 'tonapi:list+pair_discovery',
    alertSource: 'tonapi_poll',
  });
}

async function pollPulseColumn(): Promise<{ inserted: number; via: 'tonapi' }> {
  try {
    const inserted = await pollRecentJettonsFromTonApi();
    return { inserted, via: 'tonapi' };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[pointer][pulse TON] pollRecentJettonsFromTonApi failed:', msg);
    return { inserted: 0, via: 'tonapi' };
  }
}

export async function runScheduledPulsePoll(): Promise<{
  tonapi: number;
  solDas: number;
  geckoBsc: number;
  geckoBase: number;
}> {
  const ton = await pollPulseColumn();
  let solDas = 0;
  let geckoBsc = 0;
  let geckoBase = 0;
  try {
    solDas = await pollSolanaPulseFromDas();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[pointer][pulse DAS] scheduled Sol poll failed:', msg);
  }
  try {
    geckoBsc = await pollGeckoNewPools('bsc');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[pointer][pulse Gecko] BSC poll failed:', msg);
  }
  try {
    geckoBase = await pollGeckoNewPools('base');
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.warn('[pointer][pulse Gecko] Base poll failed:', msg);
  }
  return { tonapi: ton.inserted, solDas, geckoBsc, geckoBase };
}

export async function getPulseFeed(
  column: PulseColumnId,
  chain: AppChainId = DEFAULT_APP_CHAIN,
): Promise<PulseTokenBundle[]> {
  let tokens = await cachedListPulseFeedTokens(column, chain, PULSE_PAGE_SIZE);
  debugTon('getPulseFeed: DB rows after chain filter', { column, chain, count: tokens.length });

  if (chain === 'ton' && tokens.length < MIN_ROWS_BEFORE_POLL) {
    try {
      const { inserted, via } = await pollPulseColumn();
      debugTon('getPulseFeed: poll finished', { via, insertedNewMints: inserted });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isSupabase = /fetch failed|ENOTFOUND|ECONNRESET|getaddrinfo|insertTrade|upsertToken|updateToken/i.test(
        msg,
      );
      const cause = isSupabase ? 'supabase reachability' : 'ton center / tonapi / parse';
      console.warn(`[pointer][pulse TON] poll failed (${cause}):`, msg);
    }
    tokens = await cachedListPulseFeedTokens(column, chain, PULSE_PAGE_SIZE);
  } else if (chain !== 'ton' && tokens.length < MIN_ROWS_BEFORE_POLL) {
    try {
      if (chain === 'sol') {
        const inserted = await pollSolanaPulseFromDas();
        debugTon('getPulseFeed: Sol DAS poll inserted', { inserted });
      } else if (chain === 'bnb') {
        const inserted = await pollGeckoNewPools('bsc');
        debugTon('getPulseFeed: Gecko BSC poll inserted', { inserted });
      } else if (chain === 'base') {
        const inserted = await pollGeckoNewPools('base');
        debugTon('getPulseFeed: Gecko Base poll inserted', { inserted });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[pointer][pulse] chain poll failed (${chain}):`, msg);
    }
    tokens = await cachedListPulseFeedTokens(column, chain, PULSE_PAGE_SIZE);
    if (tokens.length < MIN_ROWS_BEFORE_POLL) {
      tokens = await widenChainBackfill(column, chain);
    }
  }

  if (DEBUG_TON && column === 'new' && chain === 'ton') {
    const sinceIso = subMinutes(new Date(), PULSE_THRESHOLDS.newMaxAgeMinutes).toISOString();
    debugTon('getPulseFeed: New column filter', {
      created_at_gte: sinceIso,
      windowMinutes: PULSE_THRESHOLDS.newMaxAgeMinutes,
      matchingRows: tokens.length,
    });
  }

  return bundlePulseTokens(tokens);
}

/**
 * Ensures a `tokens` row exists for jetton `mint` (master) using TonAPI metadata.
 * Optionally checks TON Center that the account is active before trusting insert.
 */
export async function ensureTokenRowFromTon(mint: string): Promise<TokenRow | null> {
  const canonical = normalizeTonAddress(mint);
  if (!canonical) return null;

  const existing = await getTokenByMint(canonical);
  if (existing) return existing;

  const active = await tonCenterAddressIsActive(canonical);
  if (active === false) return null;

  const j = await fetchTonApiJettonByMaster(canonical);
  if (!j?.metadata?.address) return null;

  const now = new Date().toISOString();
  const row = jettonToTokenRow(j, now);
  if (!row) return null;

  const saved = await upsertToken(row);
  await emitGlobalPulseNewTokenAlert({
    mint: row.mint,
    symbol: row.symbol,
    name: row.name,
    launchpad: null,
    source: 'tonapi_hydrate',
    creator_wallet: row.creator_wallet,
    initial_liquidity_sol: null,
  });
  return saved;
}

/**
 * Hydrates a Solana SPL mint via Helius DAS `getAsset` (Pulse may already have ingested it).
 */
export async function ensureTokenRowFromSolanaMint(mint: string): Promise<TokenRow | null> {
  let canonical: string;
  try {
    canonical = new PublicKey(mint.trim()).toBase58();
  } catch {
    return null;
  }

  const existing = await getTokenByMint(canonical);
  if (existing?.name?.trim()) return existing;

  try {
    getHeliusRpcUrl();
  } catch {
    return null;
  }

  try {
    const asset = await heliusDasRpc<Asset>('getAsset', { id: canonical });
    const ev = launchpadEventFromDasAsset(asset);
    if (!ev) return null;
    await ingestLaunchpadDiscovery(ev, { alertSource: 'das_hydrate' });
    return getTokenByMint(canonical);
  } catch {
    return null;
  }
}

/** Resolves a token row for TON, Solana, or EVM mints / contract addresses. */
export async function ensureTokenRowForMint(mint: string): Promise<TokenRow | null> {
  const kind = inferMintKind(mint);
  if (kind === 'ton') return ensureTokenRowFromTon(mint);
  if (kind === 'sol') return ensureTokenRowFromSolanaMint(mint);
  if (kind === 'evm') return ensureTokenRowFromGeckoEvm(mint);
  return null;
}

/** @deprecated Renamed to {@link ensureTokenRowForMint} — supports Solana + EVM, not only TON. */
export const ensureTokenRowFromDas = ensureTokenRowForMint;
