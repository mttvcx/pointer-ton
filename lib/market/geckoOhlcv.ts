import 'server-only';

import { inferMintKind } from '@/lib/chains/mintKind';
import { geckoNetworkFromRawMetadata } from '@/lib/chains/evmTokenChain';
import { getTokenByMint } from '@/lib/db/tokens';
import type { ChartInterval, OhlcBar } from '@/lib/helius/chart';

/**
 * GeckoTerminal free OHLCV feed.
 *
 * The historical-candle source for token charts. GeckoTerminal indexes DEX
 * pools on every chain Pointer trades (Solana / ETH / Base / BNB) and exposes
 * pool OHLCV for free (no key, ~30 req/min soft limit). We resolve a token's
 * deepest pool once, then pull candles for it.
 *
 * Docs: https://api.geckoterminal.com/api/v2 — `pools/{addr}/ohlcv/{timeframe}`
 * returns `data.attributes.ohlcv_list = [[ts, o, h, l, c, volume], …]` (newest
 * first, USD-quoted by default), max 1000 rows/call.
 */

const GECKO_BASE = 'https://api.geckoterminal.com/api/v2';

/** GeckoTerminal network slugs, in probe order for ambiguous EVM `0x…` mints. */
const EVM_NETWORKS = ['eth', 'base', 'bsc'] as const;

type GeckoNetwork = 'solana' | (typeof EVM_NETWORKS)[number] | 'robinhood';

type PoolCacheEntry = { network: GeckoNetwork; pool: string } | null;
const POOL_TTL_MS = 10 * 60_000; // pool of a token rarely changes — cache 10m
const poolCache = new Map<string, { at: number; value: PoolCacheEntry }>();

type BarsCacheEntry = { at: number; bars: OhlcBar[] };
const BARS_TTL_MS = 15_000; // brief cache to stay well under Gecko rate limits
const barsCache = new Map<string, BarsCacheEntry>();

function networkForMint(mint: string): GeckoNetwork[] {
  const kind = inferMintKind(mint);
  if (kind === 'sol') return ['solana'];
  if (kind === 'evm') return [...EVM_NETWORKS];
  return [];
}

type GeckoPoolsResponse = {
  data?: Array<{
    id?: string;
    attributes?: {
      address?: string | null;
      reserve_in_usd?: string | null;
    } | null;
  }>;
};

/**
 * Resolve a token's deepest DEX pool + its network. Tries the token row's known
 * gecko network first (EVM discovery stores it), otherwise probes the candidate
 * networks. Result is cached — pools are stable.
 */
async function resolveGeckoPool(mint: string): Promise<PoolCacheEntry> {
  const cached = poolCache.get(mint);
  if (cached && Date.now() - cached.at < POOL_TTL_MS) return cached.value;

  const candidates = networkForMint(mint);
  if (candidates.length === 0) {
    poolCache.set(mint, { at: Date.now(), value: null });
    return null;
  }

  // If we already know the EVM network from prior Gecko discovery, try it first.
  if (candidates.length > 1) {
    try {
      const row = await getTokenByMint(mint);
      const known = geckoNetworkFromRawMetadata(row?.raw_metadata) as GeckoNetwork | null;
      if (known && candidates.includes(known)) {
        candidates.sort((a, b) => (a === known ? -1 : b === known ? 1 : 0));
      }
    } catch {
      // best-effort ordering only
    }
  }

  for (const network of candidates) {
    try {
      const url = `${GECKO_BASE}/networks/${network}/tokens/${encodeURIComponent(mint)}/pools?page=1`;
      const res = await fetch(url, { headers: { accept: 'application/json' }, cache: 'no-store' });
      if (!res.ok) continue;
      const json = (await res.json()) as GeckoPoolsResponse;
      const pools = json.data ?? [];
      if (pools.length === 0) continue;
      // Highest USD liquidity wins.
      let best: { address: string; reserve: number } | null = null;
      for (const p of pools) {
        const addr = p.attributes?.address?.trim();
        if (!addr) continue;
        const reserve = Number(p.attributes?.reserve_in_usd ?? 0) || 0;
        if (!best || reserve > best.reserve) best = { address: addr, reserve };
      }
      if (best) {
        const value: PoolCacheEntry = { network, pool: best.address };
        poolCache.set(mint, { at: Date.now(), value });
        return value;
      }
    } catch {
      // try next network
    }
  }

  poolCache.set(mint, { at: Date.now(), value: null });
  return null;
}

/** Pointer interval → GeckoTerminal (timeframe, aggregate). Gecko lacks 3m/5d → nearest. */
function geckoTimeframe(interval: ChartInterval): { timeframe: 'minute' | 'hour' | 'day'; aggregate: number } {
  switch (interval) {
    case '1s':
    case '1m':
      return { timeframe: 'minute', aggregate: 1 };
    case '3m':
      return { timeframe: 'minute', aggregate: 1 };
    case '5m':
      return { timeframe: 'minute', aggregate: 5 };
    case '15m':
      return { timeframe: 'minute', aggregate: 15 };
    case '1h':
      return { timeframe: 'hour', aggregate: 1 };
    case '1d':
      return { timeframe: 'day', aggregate: 1 };
    case '5d':
      return { timeframe: 'day', aggregate: 1 };
    default:
      return { timeframe: 'minute', aggregate: 5 };
  }
}

type GeckoOhlcvResponse = {
  data?: { attributes?: { ohlcv_list?: Array<[number, number, number, number, number, number]> } };
};

/**
 * Fetch real OHLC candles for `mint` from GeckoTerminal. Returns bars sorted
 * oldest→newest (lightweight-charts / TradingView convention). `beforeTs`
 * (unix seconds) pages further back for the TradingView datafeed; omit for the
 * most recent window. Empty array when the token has no indexed pool.
 */
export async function getGeckoChartBars(
  mint: string,
  interval: ChartInterval,
  opts?: { limit?: number; beforeTs?: number },
): Promise<OhlcBar[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 1000, 1), 1000);
  const cacheKey = `${mint}:${interval}:${limit}:${opts?.beforeTs ?? 0}`;
  const cached = barsCache.get(cacheKey);
  if (cached && Date.now() - cached.at < BARS_TTL_MS) return cached.bars;

  const resolved = await resolveGeckoPool(mint);
  if (!resolved) return [];

  const { timeframe, aggregate } = geckoTimeframe(interval);
  const url = new URL(`${GECKO_BASE}/networks/${resolved.network}/pools/${resolved.pool}/ohlcv/${timeframe}`);
  url.searchParams.set('aggregate', String(aggregate));
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('currency', 'usd');
  if (opts?.beforeTs && Number.isFinite(opts.beforeTs)) {
    url.searchParams.set('before_timestamp', String(Math.floor(opts.beforeTs)));
  }

  let bars: OhlcBar[] = [];
  try {
    const res = await fetch(url.toString(), { headers: { accept: 'application/json' }, cache: 'no-store' });
    if (res.ok) {
      const json = (await res.json()) as GeckoOhlcvResponse;
      const list = json.data?.attributes?.ohlcv_list ?? [];
      bars = list
        .filter((r) => Array.isArray(r) && r.length >= 5 && Number.isFinite(r[1]) && r[4] > 0)
        .map((r) => ({ time: r[0], open: r[1], high: r[2], low: r[3], close: r[4] }))
        .sort((a, b) => a.time - b.time);
    }
  } catch {
    bars = [];
  }

  barsCache.set(cacheKey, { at: Date.now(), bars });
  return bars;
}
