import 'server-only';

import { subHours } from 'date-fns';
import { listTradesForMintSince } from '@/lib/db/trades';
import { getRedis } from '@/lib/redis/client';
import { createAdminSupabase } from '@/lib/supabase/server';
import {
  getLatestSnapshotForMint,
  getTokenByMint,
  type TokenHolderRow,
  type TokenRow,
} from '@/lib/db/tokens';

import type { TokenExtendedMetrics } from '@/lib/types/tokenExtendedMetrics';

const CACHE_PREFIX = 'token:extended_metrics:';
const CACHE_TTL_SEC = 60;

async function loadHolders(mint: string): Promise<TokenHolderRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('token_holders')
    .select('*')
    .eq('mint', mint)
    .order('rank', { ascending: true });
  if (error) throw new Error(`loadHolders failed: ${error.message}`);
  return data ?? [];
}

/** Pro traders count: wallets in holder set matching wallet_stats heuristics. */
async function countProTraders(holders: TokenHolderRow[]): Promise<number> {
  const addrs = holders.map((h) => h.wallet_address).filter(Boolean);
  if (addrs.length === 0) return 0;
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('wallet_stats')
    .select('wallet_address')
    .in('wallet_address', addrs.slice(0, 500))
    .gte('win_rate_30d', 0.6)
    .gte('trades_30d', 20);
  if (error) return 0;
  return data?.length ?? 0;
}

function aggregate6hTrades(trades: Awaited<ReturnType<typeof listTradesForMintSince>>) {
  let buyVol = 0;
  let sellVol = 0;
  let buys = 0;
  let sells = 0;
  for (const t of trades) {
    const usd =
      t.price_usd_at_fill != null && t.amount_token != null
        ? Math.abs(t.price_usd_at_fill * t.amount_token)
        : t.amount_sol != null
          ? t.amount_sol * 150
          : 0;
    if (t.side === 'buy') {
      buys += 1;
      buyVol += usd;
    } else {
      sells += 1;
      sellVol += usd;
    }
  }
  return {
    vol6hUsd: buyVol + sellVol,
    buys6h: buys,
    sells6h: sells,
    buyVol6hUsd: buyVol,
    sellVol6hUsd: sellVol,
    netVol6hUsd: buyVol - sellVol,
  };
}

/**
 * Compute extended token metrics on read. Cached in Redis 60s per mint.
 * Insiders / bundlers / LP burned: Phase 2 stubs (null); indexer in Phase 3.
 */
export async function getTokenExtendedMetrics(
  mint: string,
): Promise<{ metrics: TokenExtendedMetrics; token: TokenRow | null }> {
  const redis = getRedis();
  const key = `${CACHE_PREFIX}${mint}`;
  const cached = await redis.get<TokenExtendedMetrics>(key);
  if (cached) {
    const token = await getTokenByMint(mint);
    return { metrics: cached, token };
  }

  const [token, snap, holders, since] = await Promise.all([
    getTokenByMint(mint),
    getLatestSnapshotForMint(mint),
    loadHolders(mint),
    Promise.resolve(subHours(new Date(), 6).toISOString()),
  ]);

  const trades = await listTradesForMintSince(mint, since, 2_000);
  const agg = aggregate6hTrades(trades);

  let sniperPct = 0;
  for (const h of holders) {
    if (h.is_sniper && h.pct_of_supply != null) sniperPct += h.pct_of_supply;
  }

  const proTraders = await countProTraders(holders);

  const metrics: TokenExtendedMetrics = {
    top10HolderPct: snap?.top10_holder_pct ?? null,
    devHoldingPct: snap?.dev_holding_pct ?? null,
    sniperHolderPct: sniperPct > 0 ? sniperPct : null,
    insidersPct: null,
    bundlersPct: null,
    lpBurnedPct: null,
    holders: snap?.holder_count ?? null,
    proTraders,
    dexPaid: token?.is_paid ?? null,
    vol6hUsd: agg.vol6hUsd > 0 ? agg.vol6hUsd : null,
    buys6h: agg.buys6h > 0 ? agg.buys6h : null,
    sells6h: agg.sells6h > 0 ? agg.sells6h : null,
    buyVol6hUsd: agg.buyVol6hUsd > 0 ? agg.buyVol6hUsd : null,
    sellVol6hUsd: agg.sellVol6hUsd > 0 ? agg.sellVol6hUsd : null,
    netVol6hUsd:
      agg.netVol6hUsd !== 0 ? agg.netVol6hUsd : agg.vol6hUsd > 0 ? agg.netVol6hUsd : null,
  };

  await redis.set(key, JSON.stringify(metrics), { ex: CACHE_TTL_SEC });
  return { metrics, token };
}
