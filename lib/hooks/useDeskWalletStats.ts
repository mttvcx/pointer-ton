'use client';

import { useQuery } from '@tanstack/react-query';
import type { MintWalletStatsRow } from '@/lib/db/mintWalletStats';
import { isPointerQaMintClient } from '@/lib/qa/pointerQaMintClient';

export function deskWalletStatsQueryKey(mint: string, wallet: string | null | undefined) {
  return ['desk-wallet-stats', mint, wallet ?? ''] as const;
}

export function useDeskWalletStats(mint: string, wallet: string | null | undefined) {
  return useQuery({
    queryKey: deskWalletStatsQueryKey(mint, wallet),
    queryFn: async (): Promise<MintWalletStatsRow | null> => {
      const res = await fetch(
        `/api/tokens/${encodeURIComponent(mint)}/desk-wallet-stats?wallet=${encodeURIComponent(wallet!)}`,
      );
      if (!res.ok) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('[desk-wallet-stats]', res.status, mint, wallet);
        }
        return null;
      }
      const json = (await res.json()) as { stats: MintWalletStatsRow | null };
      return json.stats ?? null;
    },
    enabled: Boolean(mint && wallet && isPointerQaMintClient(mint)),
    staleTime: 5_000,
    refetchOnWindowFocus: true,
  });
}
