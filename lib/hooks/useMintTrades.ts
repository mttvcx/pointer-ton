'use client';

import { useQuery } from '@tanstack/react-query';
import type { ChainDeskTrade } from '@/lib/indexer/types';
import { isPointerQaMintClient } from '@/lib/qa/pointerQaMintClient';
import type { Tables } from '@/lib/supabase/types';

export type MintTradeRow = Tables<'trades'> & {
  chain_wallet?: string | null;
  wallet_address?: string | null;
};

/** Canonical shared cache key for a mint's recent trades. */
export function mintTradesQueryKey(mint: string) {
  return ['mint-trades', mint] as const;
}

async function fetchMintTrades(mint: string): Promise<{ trades: MintTradeRow[]; source?: string }> {
  const path = isPointerQaMintClient(mint)
    ? `/api/tokens/${encodeURIComponent(mint)}/chain-trades?limit=80`
    : `/api/tokens/${encodeURIComponent(mint)}/trades?limit=80`;
  const r = await fetch(path);
  if (!r.ok) throw new Error('trades');
  const json = (await r.json()) as { trades: (MintTradeRow | ChainDeskTrade)[]; source?: string };
  return {
    trades: json.trades.map((t) => ({
      ...t,
      chain_wallet: 'chain_wallet' in t ? t.chain_wallet : null,
    })),
    source: json.source,
  };
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
