'use client';

import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useActiveSolanaWallet } from '@/lib/hooks/useActiveSolanaWallet';
import { useWalletNativeBalance } from '@/lib/hooks/useWalletNativeBalance';
import { usePortfolioRefreshListener } from '@/lib/hooks/usePortfolioRefreshListener';
import { parseLamportsStringToSol } from '@/lib/utils/formatters';
import { useUIStore } from '@/store/ui';
import { mintMatchesAppChain } from '@/lib/chains/mintKind';
import { usePnlTrackerStore } from '@/store/pnlTracker';
import { fetchPortfolioJson, portfolioQueryKey } from '@/lib/portfolio/portfolioQuery';
import { useAuthSyncStore } from '@/store/authSync';

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
  const pnlOpen = usePnlTrackerStore((s) => s.open);
  const backendReady = useAuthSyncStore((s) => s.backendReady);

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

  // Live native SOL balance for the wallet in view — same source the topbar uses,
  // so the widget's Balance always matches the header (the portfolio query below is
  // gated on backendReady + pnlOpen and would otherwise leave Balance stuck at 0).
  const balanceWalletAddress = scopedWallet ?? activeAddress ?? null;
  const balanceWalletRow = walletsQ.data?.wallets?.find(
    (w) => w.wallet_address === balanceWalletAddress,
  );
  const nativeBalanceQ = useWalletNativeBalance({
    enabled: authenticated && activeChain === 'sol' && Boolean(balanceWalletRow?.id),
    walletId: balanceWalletRow?.id,
    fallbackLamports: balanceWalletRow?.balance_lamports,
    getAccessToken,
  });

  const portfolioEnabled = Boolean(
    authenticated &&
      backendReady &&
      walletsReady &&
      activeChain === 'sol' &&
      (portfolioScope !== null ||
        Boolean(activeAddress && mintMatchesAppChain(activeAddress, 'sol'))),
  );

  const portfolioQ = useQuery({
    queryKey: portfolioQueryKey(scopedWallet),
    queryFn: () => fetchPortfolioJson<PortfolioSummary>(getAccessToken, scopedWallet),
    enabled: portfolioEnabled && pnlOpen,
    staleTime: 60_000,
    refetchOnWindowFocus: pnlOpen,
  });

  const refreshPortfolio = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
  }, [queryClient]);

  usePortfolioRefreshListener(refreshPortfolio, portfolioEnabled);

  // Prefer the live native balance; fall back to the portfolio snapshot's SOL.
  const solBalance =
    (nativeBalanceQ.data?.ui ?? null) ??
    parseLamportsStringToSol(portfolioQ.data?.solLamports) ??
    0;
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
