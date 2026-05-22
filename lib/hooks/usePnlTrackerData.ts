'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
import { usePortfolioRefreshListener } from '@/lib/hooks/usePortfolioRefreshListener';
import { parseLamportsStringToSol } from '@/lib/utils/formatters';
import { useUIStore } from '@/store/ui';
import { mintMatchesAppChain } from '@/lib/chains/mintKind';
import { usePnlTrackerStore } from '@/store/pnlTracker';

type PortfolioSummary = {
  solLamports: string | null;
  solUsd: number | null;
  summary: {
    totalPnlUsd: number;
    unrealizedPnlUsd: number;
    realizedPnlUsd: number;
  };
};

export function usePnlTrackerData() {
  const queryClient = useQueryClient();
  const { authenticated, getAccessToken } = usePointerAuth();
  const activeChain = useUIStore((s) => s.activeChain);
  const portfolioScope = usePnlTrackerStore((s) => s.portfolioScope);

  const walletsQ = useQuery({
    queryKey: ['wallets-my'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/wallets/my', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('wallets');
      return res.json() as Promise<{ wallets: import('@/lib/hooks/useActiveSolanaWallet').MyWalletRow[] }>;
    },
    enabled: authenticated,
    staleTime: 30_000,
  });

  const { activeAddress, ready: walletsReady } = useActiveSolanaWallet(walletsQ.data?.wallets);
  const scopedWallet =
    portfolioScope !== null ? portfolioScope.walletAddress : activeAddress ?? null;

  const portfolioEnabled = Boolean(
    authenticated &&
      walletsReady &&
      activeChain === 'sol' &&
      (portfolioScope !== null ||
        Boolean(activeAddress && mintMatchesAppChain(activeAddress, 'sol'))),
  );

  const portfolioQ = useQuery({
    queryKey: ['pnl-tracker', portfolioScope?.label ?? 'active', scopedWallet ?? 'all'],
    queryFn: async (): Promise<PortfolioSummary> => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const q = scopedWallet
        ? `?wallet=${encodeURIComponent(scopedWallet)}&tradesLimit=20&fifoLimit=500`
        : '?tradesLimit=20&fifoLimit=500';
      const res = await fetch(`/api/portfolio${q}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error('portfolio');
      return res.json() as Promise<PortfolioSummary>;
    },
    enabled: portfolioEnabled,
    staleTime: 60_000,
    refetchOnWindowFocus: true,
  });

  const refreshPortfolio = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['pnl-tracker'] });
  }, [queryClient]);

  usePortfolioRefreshListener(refreshPortfolio, portfolioEnabled);

  const solBalance = parseLamportsStringToSol(portfolioQ.data?.solLamports) ?? 0;
  const solUsd = portfolioQ.data?.solUsd ?? null;
  const totalPnlUsd = portfolioQ.data?.summary?.totalPnlUsd ?? 0;
  const totalPnlSol =
    solUsd != null && solUsd > 0 ? totalPnlUsd / solUsd : totalPnlUsd > 0 ? totalPnlUsd / 150 : 0;

  return {
    solBalance,
    totalPnlUsd,
    totalPnlSol,
    solUsd,
    isLoading: portfolioQ.isLoading || walletsQ.isLoading,
    isFetching: portfolioQ.isFetching,
    refetch: portfolioQ.refetch,
    authenticated,
    activeChain,
    portfolioScope,
  };
}
