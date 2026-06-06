'use client';

import { useQuery } from '@tanstack/react-query';
import type { Tables } from '@/lib/supabase/types';

export type MintTradeRow = Tables<'trades'>;

/** Canonical shared cache key for a mint's recent trades. */
export function mintTradesQueryKey(mint: string) {
  return ['mint-trades', mint] as const;
}

async function fetchMintTrades(mint: string): Promise<{ trades: MintTradeRow[] }> {
  const r = await fetch(`/api/tokens/${encodeURIComponent(mint)}/trades?limit=80`);
  if (!r.ok) throw new Error('trades');
  return r.json() as Promise<{ trades: MintTradeRow[] }>;
}

type MintTradesOptions = {
  enabled?: boolean;
  refetchInterval?: number | false;
  refetchOnWindowFocus?: boolean;
  placeholderData?: { trades: MintTradeRow[] };
  staleTime?: number;
};

/**
 * Shared `/api/tokens/[mint]/trades` query. The trades desk (TokenActivityTabs)
 * and the known-wallet activity strip both read from one cache entry under
 * `['mint-trades', mint]`, so a single network request serves both surfaces
 * instead of two parallel fetches to the same endpoint.
 *
 * Callers tune their own `enabled` / `refetchInterval`; the query refetches at
 * the fastest active observer's interval.
 */
export function useMintTrades(mint: string, opts?: MintTradesOptions) {
  return useQuery({
    queryKey: mintTradesQueryKey(mint),
    queryFn: () => fetchMintTrades(mint),
    enabled: opts?.enabled,
    refetchInterval: opts?.refetchInterval,
    refetchOnWindowFocus: opts?.refetchOnWindowFocus,
    placeholderData: opts?.placeholderData,
    staleTime: opts?.staleTime ?? 15_000,
  });
}
