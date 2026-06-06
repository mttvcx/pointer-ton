'use client';

import { useQuery } from '@tanstack/react-query';

export type TickerRow = {
  symbol: string;
  usdPrice: number | null;
  priceChange24h: number | null;
};

/** Canonical native/price ticker payload — shared cache key `['jupiter-tickers']`. */
async function fetchJupiterTickers(): Promise<TickerRow[]> {
  const res = await fetch('/api/prices/tickers');
  const json: unknown = await res.json();
  const arr =
    json && typeof json === 'object' && 'tickers' in json
      ? (json as { tickers: TickerRow[] }).tickers
      : [];
  return Array.isArray(arr) ? arr : [];
}

type TickerQueryOptions<T> = {
  enabled?: boolean;
  staleTime?: number;
  refetchInterval?: number | false;
  refetchIntervalInBackground?: boolean;
  select?: (rows: TickerRow[]) => T;
};

/**
 * Shared Jupiter tickers query. Every consumer reads one cache entry so the
 * `/api/prices/tickers` endpoint is fetched once across the shell, portfolio,
 * token chart and dock footer. Use `select` to derive a per-consumer value
 * without splitting the cache key.
 */
export function useJupiterTickers<T = TickerRow[]>(opts?: TickerQueryOptions<T>) {
  return useQuery({
    queryKey: ['jupiter-tickers'],
    queryFn: fetchJupiterTickers,
    staleTime: opts?.staleTime ?? 25_000,
    refetchInterval: opts?.refetchInterval,
    // Decorative price ticker — never keep polling while the tab is hidden.
    refetchIntervalInBackground: opts?.refetchIntervalInBackground ?? false,
    enabled: opts?.enabled,
    select: opts?.select,
  });
}

/** Native USD spot for a single ticker symbol, derived from the shared cache. */
export function useNativeUsdSpot(
  symbol: string,
  opts?: { enabled?: boolean; staleTime?: number },
) {
  return useJupiterTickers<number | null>({
    enabled: opts?.enabled,
    staleTime: opts?.staleTime ?? 30_000,
    select: (rows) => rows.find((t) => t.symbol === symbol)?.usdPrice ?? null,
  });
}
