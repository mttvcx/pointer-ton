'use client';

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { TraderMintHoverStats } from '@/lib/trading/mintTopTraders';
import { syntheticTraderMintStats } from '@/lib/dev/demoTokenFixtures';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';

export function useTraderMintHoverStats(
  mint: string | undefined,
  wallet: string | undefined,
  enabled: boolean,
): { stats: TraderMintHoverStats | null | undefined; isLoading: boolean } {
  const uiDemo = useUiDemoMode();

  const q = useQuery({
    queryKey: ['trader-mint-stats', mint, wallet],
    queryFn: async (): Promise<{ stats: TraderMintHoverStats | null }> => {
      const r = await fetch(
        `/api/tokens/${encodeURIComponent(mint ?? '')}/trader-stats?wallet=${encodeURIComponent(wallet ?? '')}`,
      );
      if (!r.ok) throw new Error('stats');
      return r.json() as Promise<{ stats: TraderMintHoverStats | null }>;
    },
    enabled: Boolean(!uiDemo && mint && wallet && enabled),
    staleTime: 20_000,
  });

  const stats = useMemo(() => {
    if (uiDemo && wallet) return syntheticTraderMintStats(wallet);
    return q.data?.stats;
  }, [uiDemo, wallet, q.data?.stats]);

  return { stats, isLoading: q.isLoading };
}
