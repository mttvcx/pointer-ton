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
import type { TablesInsert } from '@/lib/supabase/types';

const CACHE_PREFIX = 'token:holders:v1:';
const CACHE_TTL_SEC = 120;
const DB_FRESH_MS = 3 * 60_000;

export type ResolvedTokenHolders = {
  mint: string;
  decimals: number;
  holders: TokenHolderRow[];
  holderCount: number | null;
  top10HolderPct: number | null;
  devHoldingPct: number | null;
  source: 'cache' | 'db' | 'live';
};

type CachedPayload = {
  mint: string;
  decimals: number;
  holders: TokenHolderRow[];
  holderCount: number | null;
  top10HolderPct: number | null;
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
  return toHolderRows(mint, inserts);
}

/**
 * Holders for token detail — Redis → fresh DB → live Solana RPC (then cache + persist).
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
      holderCount: db.length > 0 ? db.length : null,
      top10HolderPct: null,
      devHoldingPct: null,
      source: 'db',
    };
  }

  const redis = getRedis();
  const cacheKey = `${CACHE_PREFIX}${mint}`;
  if (!opts?.forceLive) {
    const cached = await redis.get<CachedPayload>(cacheKey);
    if (cached?.holders?.length) {
      return { ...cached, source: 'cache' };
    }
  }

  const limit = opts?.limit ?? 20;
  if (!opts?.forceLive) {
    const db = await listTopHolders(mint, limit);
    if (dbRowsFresh(db)) {
      const top10 = db.slice(0, 10).reduce((s, h) => s + (h.pct_of_supply ?? 0), 0);
      const dev = db.find((h) => h.is_dev);
      const payload: CachedPayload = {
        mint,
        decimals: (await getTokenByMint(mint))?.decimals ?? 9,
        holders: db,
        holderCount: null,
        top10HolderPct: top10 > 0 ? top10 : null,
        devHoldingPct: dev?.pct_of_supply ?? null,
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

  const holders = await persistLiveSnapshot(mint, live.holders);
  const payload: CachedPayload = {
    mint: live.mint,
    decimals: live.decimals,
    holders,
    holderCount: live.holderCount,
    top10HolderPct: live.top10HolderPct,
    devHoldingPct: live.devHoldingPct,
    fetchedAt: live.fetchedAt,
  };
  await redis.set(cacheKey, JSON.stringify(payload), { ex: CACHE_TTL_SEC });
  return { ...payload, source: 'live' };
}
