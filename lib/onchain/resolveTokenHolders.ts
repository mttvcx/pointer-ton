import 'server-only';

import { inferMintKind } from '@/lib/chains/mintKind';
import {
  listTopHolders,
  replaceTopHolders,
  type TokenHolderRow,
  getTokenByMint,
} from '@/lib/db/tokens';
import { getRedis } from '@/lib/redis/client';
import { fetchSolanaTokenHolderSnapshot } from '@/lib/onchain/solanaTokenHolders';
import { fetchMoralisTokenHolderSnapshot } from '@/lib/onchain/moralisTokenHolders';
import { computeTop10HolderPct, computeAdjustedTop10HolderPct, dedupeTokenHolderRows } from '@/lib/onchain/dedupeTokenHolders';
import { resolveKnownPoolAddresses } from '@/lib/onchain/resolveKnownPoolAddresses';
import type { TablesInsert } from '@/lib/supabase/types';

const CACHE_PREFIX = 'token:holders:v3:';
const CACHE_TTL_SEC = 120;
const DB_FRESH_MS = 3 * 60_000;

export type ResolvedTokenHolders = {
  mint: string;
  decimals: number;
  holders: TokenHolderRow[];
  /** Total on-chain holders when provider exposes it (Moralis / GPA). Never row count. */
  holderCountTotal: number | null;
  /** Rows returned in this response (top-N desk list). */
  holderRowsLoaded: number;
  top10HolderPct: number | null;
  top10HolderPctRaw: number | null;
  top10HolderPctAdjusted: number | null;
  devHoldingPct: number | null;
  source: 'cache' | 'db' | 'live';
};

type CachedPayload = {
  mint: string;
  decimals: number;
  holders: TokenHolderRow[];
  holderCountTotal: number | null;
  holderRowsLoaded: number;
  top10HolderPct: number | null;
  top10HolderPctRaw: number | null;
  top10HolderPctAdjusted: number | null;
  devHoldingPct: number | null;
  fetchedAt: string;
};

function dbRowsFresh(rows: TokenHolderRow[]): boolean {
  if (rows.length === 0) return false;
  const ts = rows[0]?.computed_at;
  if (!ts) return false;
  return Date.now() - new Date(ts).getTime() < DB_FRESH_MS;
}

function toHolderRows(
  mint: string,
  inserts: TablesInsert<'token_holders'>[],
): TokenHolderRow[] {
  return inserts.map((row, i) => ({
    id: row.rank ?? i + 1,
    mint,
    wallet_address: row.wallet_address,
    amount_raw: row.amount_raw,
    pct_of_supply: row.pct_of_supply ?? null,
    is_dev: row.is_dev ?? null,
    is_sniper: row.is_sniper ?? null,
    rank: row.rank ?? i + 1,
    computed_at: row.computed_at ?? new Date().toISOString(),
  }));
}

async function persistLiveSnapshot(
  mint: string,
  inserts: TablesInsert<'token_holders'>[],
): Promise<TokenHolderRow[]> {
  if (inserts.length === 0) return [];
  try {
    await replaceTopHolders(mint, inserts);
    const stored = await listTopHolders(mint, inserts.length);
    if (stored.length > 0) return stored;
  } catch (err) {
    console.warn(
      '[holders] persist failed:',
      err instanceof Error ? err.message : err,
    );
  }
  return dedupeTokenHolderRows(toHolderRows(mint, inserts));
}

function finalizeHolders(rows: TokenHolderRow[]): TokenHolderRow[] {
  return dedupeTokenHolderRows(rows);
}

async function enrichHolderMetrics(
  mint: string,
  holders: TokenHolderRow[],
  partial: {
    decimals: number;
    holderCountTotal: number | null;
    devHoldingPct: number | null;
    top10FromProvider?: number | null;
  },
): Promise<Pick<
  CachedPayload,
  | 'holderCountTotal'
  | 'holderRowsLoaded'
  | 'top10HolderPct'
  | 'top10HolderPctRaw'
  | 'top10HolderPctAdjusted'
  | 'devHoldingPct'
>> {
  const poolCtx = await resolveKnownPoolAddresses(mint);
  const raw = computeTop10HolderPct(holders) ?? partial.top10FromProvider ?? null;
  const adjusted = computeAdjustedTop10HolderPct(holders, poolCtx.addresses);
  return {
    holderCountTotal: partial.holderCountTotal,
    holderRowsLoaded: holders.length,
    top10HolderPct: adjusted ?? raw,
    top10HolderPctRaw: raw,
    top10HolderPctAdjusted: adjusted,
    devHoldingPct: partial.devHoldingPct,
  };
}

/**
 * Holders for token detail — Redis → fresh DB → live Moralis/RPC (then cache + persist).
 */
export async function resolveTokenHolders(
  mint: string,
  opts?: { limit?: number; forceLive?: boolean },
): Promise<ResolvedTokenHolders | null> {
  const kind = inferMintKind(mint);
  if (kind !== 'sol') {
    const token = await getTokenByMint(mint);
    const db = await listTopHolders(mint, opts?.limit ?? 20);
    return {
      mint,
      decimals: token?.decimals ?? 9,
      holders: db,
      holderCountTotal: null,
      holderRowsLoaded: db.length,
      top10HolderPct: null,
      top10HolderPctRaw: null,
      top10HolderPctAdjusted: null,
      devHoldingPct: null,
      source: 'db',
    };
  }

  const redis = getRedis();
  const cacheKey = `${CACHE_PREFIX}${mint}`;
  if (!opts?.forceLive) {
    const cached = await redis.get<CachedPayload>(cacheKey);
    if (cached?.holders?.length) {
      const holders = finalizeHolders(cached.holders);
      const metrics = await enrichHolderMetrics(mint, holders, {
        decimals: cached.decimals,
        holderCountTotal: cached.holderCountTotal,
        devHoldingPct: cached.devHoldingPct,
        top10FromProvider: cached.top10HolderPctRaw,
      });
      return {
        mint: cached.mint,
        decimals: cached.decimals,
        holders,
        ...metrics,
        source: 'cache',
      };
    }
  }

  const limit = opts?.limit ?? 20;
  if (!opts?.forceLive) {
    const db = await listTopHolders(mint, limit);
    if (dbRowsFresh(db)) {
      const holders = finalizeHolders(db);
      const dev = holders.find((h) => h.is_dev);
      const tokenRow = await getTokenByMint(mint);
      const metrics = await enrichHolderMetrics(mint, holders, {
        decimals: tokenRow?.decimals ?? 9,
        holderCountTotal: null,
        devHoldingPct: dev?.pct_of_supply ?? null,
      });
      const payload: CachedPayload = {
        mint,
        decimals: tokenRow?.decimals ?? 9,
        holders,
        ...metrics,
        fetchedAt: db[0]!.computed_at,
      };
      await redis.set(cacheKey, JSON.stringify(payload), { ex: CACHE_TTL_SEC });
      return { ...payload, source: 'db' };
    }
  }

  const token = await getTokenByMint(mint);
  let live =
    (await fetchMoralisTokenHolderSnapshot(mint, {
      limit,
      creatorWallet: token?.creator_wallet ?? null,
    })) ??
    (await fetchSolanaTokenHolderSnapshot(mint, {
      limit,
      creatorWallet: token?.creator_wallet ?? null,
    }));
  if (!live) return null;

  const holders = finalizeHolders(await persistLiveSnapshot(mint, live.holders));
  const metrics = await enrichHolderMetrics(mint, holders, {
    decimals: live.decimals,
    holderCountTotal: live.holderCountTotal,
    devHoldingPct: live.devHoldingPct,
    top10FromProvider: live.top10HolderPct,
  });
  const payload: CachedPayload = {
    mint: live.mint,
    decimals: live.decimals,
    holders,
    ...metrics,
    fetchedAt: live.fetchedAt,
  };
  await redis.set(cacheKey, JSON.stringify(payload), { ex: CACHE_TTL_SEC });
  return { ...payload, source: 'live' };
}
