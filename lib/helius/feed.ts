import 'server-only';
import { subMinutes } from 'date-fns';
import { emitGlobalPulseNewTokenAlert } from '@/lib/alerts/generate';
import {
  bundlePulseTokens,
  getTokenByMint,
  listPulseMigratedTokens,
  listPulseNewTokens,
  listPulseStretchTokens,
  type TokenRow,
  updateToken,
  upsertToken,
} from '@/lib/db/tokens';
import { getHeliusClient } from '@/lib/helius/client';
import { launchpadEventFromDasAsset } from '@/lib/helius/parsers';
import { extractSocialUrlsFromAsset } from '@/lib/tokens/pulseSocialLinks';
import type { TablesInsert } from '@/lib/supabase/types';
import {
  LAUNCHPAD_AUTHORITIES,
  LAUNCHPAD_LABELS,
  PULSE_DAS_FALLBACK_POLL_OWNER,
  PULSE_THRESHOLDS,
  type LaunchpadId,
  type PulseColumnId,
} from '@/lib/utils/constants';
import { isValidPublicKey } from '@/lib/utils/addresses';
import type { PulseTokenBundle } from '@/types/tokens';
import type { Asset } from 'helius-sdk/types/das';

const PULSE_PAGE_SIZE = 60;
const DAS_POLL_BATCH = 48;
/** When a column has fewer than this many rows, backfill from DAS once. */
const MIN_ROWS_BEFORE_POLL = 6;

const DEBUG_DAS = process.env.POINTER_DEBUG_DAS === '1';

function debugDas(message: string, extra?: Record<string, unknown>) {
  if (!DEBUG_DAS) return;
  if (extra && Object.keys(extra).length > 0) {
    console.log(`[pointer][pulse DAS] ${message}`, extra);
  } else {
    console.log(`[pointer][pulse DAS] ${message}`);
  }
}

/**
 * Helius `searchAssets` requires `ownerAddress` when `tokenType` is set.
 * Override via `PULSE_DAS_POLL_OWNER_WALLET`; otherwise a bootstrap address
 * from Helius docs keeps dev feeds non-empty.
 *
 * NOTE: Legacy code path. The bootstrap wallet returns a fixed set of mints,
 * so the New (< 30m) column drains 30 min after the first ingest. Prefer
 * `pollNewMintsByLaunchpadAuthority` (used by `pollPulseColumn`) which uses
 * `getAssetsByAuthority(sortBy: created desc)` against a launchpad authority.
 */
function resolveDasPollOwner(): string {
  const raw = process.env.PULSE_DAS_POLL_OWNER_WALLET?.trim();
  if (raw) {
    if (isValidPublicKey(raw)) return raw;
    console.warn(
      '[pointer][pulse DAS] PULSE_DAS_POLL_OWNER_WALLET is not a valid base58 pubkey; using fallback owner',
    );
  }
  return PULSE_DAS_FALLBACK_POLL_OWNER;
}

/**
 * Parse `PULSE_DAS_LAUNCHPAD_AUTHORITIES="pad:pubkey,pad:pubkey,..."` and
 * fall back to the non-null entries in `LAUNCHPAD_AUTHORITIES`. The order
 * is preserved (first env-listed pad polls first).
 */
function resolveLaunchpadAuthorities(): Array<{ launchpad: LaunchpadId; address: string }> {
  const out: Array<{ launchpad: LaunchpadId; address: string }> = [];
  const seen = new Set<string>();

  const envRaw = process.env.PULSE_DAS_LAUNCHPAD_AUTHORITIES?.trim();
  if (envRaw) {
    for (const part of envRaw.split(',')) {
      const [padRaw, addrRaw] = part.split(':');
      const pad = padRaw?.trim() as LaunchpadId | undefined;
      const addr = addrRaw?.trim();
      if (!pad || !addr) continue;
      if (!(pad in LAUNCHPAD_LABELS)) {
        console.warn(`[pointer][pulse DAS] PULSE_DAS_LAUNCHPAD_AUTHORITIES: unknown pad "${pad}"`);
        continue;
      }
      if (!isValidPublicKey(addr)) {
        console.warn(`[pointer][pulse DAS] PULSE_DAS_LAUNCHPAD_AUTHORITIES: invalid pubkey for "${pad}"`);
        continue;
      }
      if (seen.has(addr)) continue;
      seen.add(addr);
      out.push({ launchpad: pad, address: addr });
    }
  }

  for (const [pad, address] of Object.entries(LAUNCHPAD_AUTHORITIES) as Array<
    [LaunchpadId, string | null]
  >) {
    if (!address || seen.has(address)) continue;
    seen.add(address);
    out.push({ launchpad: pad, address });
  }

  return out;
}

/**
 * TODO: replace with webhooks - we poll DAS when the DB is thin.
 *
 * Helius behavior (verified with `scripts/probe-das.mjs`):
 * - Without `ownerAddress`: `Must provide owner_address when using token_type field`.
 * - With `ownerAddress` + `sortBy: "created"`: `Only sorting based on id is supported`.
 */
export async function pollRecentFungiblesFromDas(): Promise<number> {
  const helius = getHeliusClient();
  const owner = resolveDasPollOwner();
  debugDas('searchAssets request', {
    ownerPreview: `${owner.slice(0, 4)}...${owner.slice(-4)}`,
    limit: DAS_POLL_BATCH,
    sortBy: 'id desc',
  });

  const res = await helius.searchAssets({
    ownerAddress: owner,
    tokenType: 'fungible',
    page: 1,
    limit: DAS_POLL_BATCH,
    sortBy: { sortBy: 'id', sortDirection: 'desc' },
  });

  const items = res.items ?? [];
  debugDas('searchAssets response', {
    total: res.total,
    itemsReturned: items.length,
    lastIndexedSlot: res.last_indexed_slot,
    sample: items.slice(0, 5).map((a) => ({
      id: a.id,
      interface: a.interface,
      symbol: a.content?.metadata?.symbol ?? null,
    })),
  });

  return ingestAssets(items, { source: 'searchAssets', alertSource: 'das_search' });
}

interface IngestOptions {
  source: string;
  /** Override `launch_pad` for every row (used when polling by launchpad authority). */
  launchpadOverride?: LaunchpadId;
  /** Used for global Pulse ticker alerts on first insert. */
  alertSource: 'das_authority' | 'das_search';
}

/**
 * Shared ingest path: parse each DAS asset into a `LaunchpadEvent`, then
 * insert (new mint) or update (refresh metadata + `last_seen_at`) per row.
 * Returns the count of newly-inserted mints.
 */
async function ingestAssets(items: Asset[], opts: IngestOptions): Promise<number> {
  let inserted = 0;
  let updated = 0;
  let skippedInvalidEv = 0;
  const now = new Date().toISOString();

  for (const asset of items) {
    const ev = launchpadEventFromDasAsset(asset);
    if (!ev) {
      skippedInvalidEv += 1;
      continue;
    }
    const launchpadId = opts.launchpadOverride ?? ev.launchpad;
    const launchpadColumn: string | null =
      launchpadId === 'unknown' ? null : launchpadId;

    const social = extractSocialUrlsFromAsset(asset);

    const row: TablesInsert<'tokens'> = {
      mint: ev.mint,
      symbol: ev.symbol,
      name: ev.name,
      decimals: asset.token_info?.decimals ?? 6,
      image_url: ev.image_url,
      description: asset.content?.metadata?.description ?? null,
      creator_wallet: ev.creator_wallet,
      launch_pad: launchpadColumn,
      raw_metadata: ev.raw,
      website_url: social.website_url,
      telegram_url: social.telegram_url,
      twitter_handle: social.twitter_handle,
      created_at: now,
      last_seen_at: now,
    };

    const existing = await getTokenByMint(ev.mint);
    if (existing) {
      await updateToken(ev.mint, {
        last_seen_at: now,
        raw_metadata: ev.raw,
        symbol: row.symbol ?? existing.symbol,
        name: row.name ?? existing.name,
        image_url: row.image_url ?? existing.image_url,
        description: row.description ?? existing.description,
        creator_wallet: row.creator_wallet ?? existing.creator_wallet,
        // Prefer a known launchpad over the existing null/unknown attribution.
        launch_pad: launchpadColumn ?? existing.launch_pad,
        decimals: row.decimals ?? existing.decimals,
        website_url: social.website_url ?? existing.website_url,
        telegram_url: social.telegram_url ?? existing.telegram_url,
        twitter_handle: social.twitter_handle ?? existing.twitter_handle,
      });
      updated += 1;
    } else {
      await upsertToken(row);
      inserted += 1;
      await emitGlobalPulseNewTokenAlert({
        mint: ev.mint,
        symbol: row.symbol,
        name: row.name,
        launchpad: launchpadId === 'unknown' ? null : launchpadId,
        source: opts.alertSource,
        creator_wallet: row.creator_wallet,
        initial_liquidity_sol: ev.initial_liquidity_sol ?? row.initial_liquidity_sol ?? null,
      });
    }
  }

  debugDas(`${opts.source} ingest summary`, {
    inserted,
    updated,
    skippedInvalidEv,
    itemsSeen: items.length,
  });

  return inserted;
}

/**
 * Pull freshly minted tokens for a single launchpad by their static metadata
 * authority address. `getAssetsByAuthority` with `sortBy: created desc` is
 * the only DAS path that surfaces genuinely new mints without webhooks.
 */
export async function pollNewMintsByLaunchpadAuthority(
  authority: string,
  launchpad: LaunchpadId,
  limit = 100,
): Promise<number> {
  const helius = getHeliusClient();
  debugDas('getAssetsByAuthority request', {
    launchpad,
    authorityPreview: `${authority.slice(0, 4)}...${authority.slice(-4)}`,
    limit,
    sortBy: 'created desc',
  });

  const res = await helius.getAssetsByAuthority({
    authorityAddress: authority,
    page: 1,
    limit,
    sortBy: { sortBy: 'created', sortDirection: 'desc' },
  });

  const items = (res.items ?? []) as Asset[];
  debugDas('getAssetsByAuthority response', {
    launchpad,
    total: res.total,
    itemsReturned: items.length,
    lastIndexedSlot: res.last_indexed_slot,
    sample: items.slice(0, 3).map((a) => ({
      id: a.id,
      symbol: a.content?.metadata?.symbol ?? null,
    })),
  });

  return ingestAssets(items, {
    source: `getAssetsByAuthority(${launchpad})`,
    launchpadOverride: launchpad,
    alertSource: 'das_authority',
  });
}

async function listTokensForColumn(column: PulseColumnId) {
  switch (column) {
    case 'new':
      return listPulseNewTokens(PULSE_PAGE_SIZE);
    case 'stretch':
      return listPulseStretchTokens(PULSE_PAGE_SIZE);
    case 'migrated':
      return listPulseMigratedTokens(PULSE_PAGE_SIZE);
    default:
      return listPulseNewTokens(PULSE_PAGE_SIZE);
  }
}

/**
 * Run the active Pulse poll. Prefers per-launchpad
 * `getAssetsByAuthority(sortBy: created desc)` so the New (< 30m) column sees
 * actually-fresh mints. Falls back to the legacy owner-based poll only if no
 * launchpad authority resolves (no env override, all built-ins null).
 */
async function pollPulseColumn(): Promise<{ inserted: number; via: 'authority' | 'legacy-owner' }> {
  const authorities = resolveLaunchpadAuthorities();
  if (authorities.length === 0) {
    debugDas('pollPulseColumn: no launchpad authorities resolved; using legacy owner poll');
    return { inserted: await pollRecentFungiblesFromDas(), via: 'legacy-owner' };
  }

  let inserted = 0;
  for (const { launchpad, address } of authorities) {
    try {
      inserted += await pollNewMintsByLaunchpadAuthority(address, launchpad);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(
        `[pointer][pulse DAS] pollNewMintsByLaunchpadAuthority(${launchpad}) failed:`,
        msg,
      );
    }
  }
  return { inserted, via: 'authority' };
}

/**
 * Run a full DAS poll (all configured launchpad authorities or legacy owner
 * path). For cron jobs so Pulse indexing and global ticker alerts keep moving
 * without a user opening `/pulse`.
 */
export async function runScheduledPulsePoll(): Promise<{
  inserted: number;
  via: 'authority' | 'legacy-owner';
}> {
  return pollPulseColumn();
}

export async function getPulseFeed(column: PulseColumnId): Promise<PulseTokenBundle[]> {
  let tokens = await listTokensForColumn(column);
  debugDas('getPulseFeed: DB rows before poll', { column, count: tokens.length });

  if (tokens.length < MIN_ROWS_BEFORE_POLL) {
    try {
      const { inserted, via } = await pollPulseColumn();
      debugDas('getPulseFeed: poll finished', { via, insertedNewMints: inserted });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      const isSupabase = /fetch failed|ENOTFOUND|ECONNRESET|getaddrinfo|insertTrade|upsertToken|updateToken/i.test(msg);
      const cause = isSupabase ? 'supabase reachability' : 'helius / parse';
      console.warn(`[pointer][pulse DAS] poll failed (${cause}):`, msg);
    }
    tokens = await listTokensForColumn(column);
  }

  if (DEBUG_DAS && column === 'new') {
    const sinceIso = subMinutes(new Date(), PULSE_THRESHOLDS.newMaxAgeMinutes).toISOString();
    debugDas('getPulseFeed: New column filter', {
      created_at_gte: sinceIso,
      windowMinutes: PULSE_THRESHOLDS.newMaxAgeMinutes,
      matchingRows: tokens.length,
    });
  }

  return bundlePulseTokens(tokens);
}

/**
 * Ensures a `tokens` row exists for `mint` by hydrating from Helius DAS once.
 * Used for deep links and token detail before Pulse has indexed the mint.
 */
export async function ensureTokenRowFromDas(mint: string): Promise<TokenRow | null> {
  const existing = await getTokenByMint(mint);
  if (existing) return existing;

  const helius = getHeliusClient();
  let asset: Asset | null = null;
  try {
    asset = await helius.getAsset({ id: mint, options: { showFungible: true } });
  } catch {
    return null;
  }
  if (!asset?.id) return null;

  const ev = launchpadEventFromDasAsset(asset);
  if (!ev) return null;

  const social = extractSocialUrlsFromAsset(asset);

  const now = new Date().toISOString();
  const row: TablesInsert<'tokens'> = {
    mint: ev.mint,
    symbol: ev.symbol,
    name: ev.name,
    decimals: asset.token_info?.decimals ?? 6,
    image_url: ev.image_url,
    description: asset.content?.metadata?.description ?? null,
    creator_wallet: ev.creator_wallet,
    launch_pad: ev.launchpad === 'unknown' ? null : ev.launchpad,
    raw_metadata: ev.raw,
    website_url: social.website_url,
    telegram_url: social.telegram_url,
    twitter_handle: social.twitter_handle,
    created_at: now,
    last_seen_at: now,
  };
  const saved = await upsertToken(row);
  await emitGlobalPulseNewTokenAlert({
    mint: ev.mint,
    symbol: row.symbol,
    name: row.name,
    launchpad: ev.launchpad === 'unknown' ? null : ev.launchpad,
    source: 'das_hydrate',
    creator_wallet: row.creator_wallet,
    initial_liquidity_sol: row.initial_liquidity_sol ?? null,
  });
  return saved;
}
