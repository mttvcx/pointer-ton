'use client';

import { useCallback, useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { POINTER_WALLET_BALANCE_REFRESH_EVT } from '@/lib/client/portfolioRefreshEvents';

/**
 * Event-driven on-chain balance refresh — no interval polling.
 * Refreshes on tab focus, wallet-balance events, and after trades.
 */
export function useWalletBalancesPoll(opts: {
  enabled: boolean;
  walletIds: string[];
  getAccessToken: () => Promise<string | null>;
  queryClient: QueryClient;
}) {
  const { enabled, walletIds, getAccessToken, queryClient } = opts;

  const refreshAll = useCallback(async () => {
    if (!enabled || walletIds.length === 0) return;
    const token = await getAccessToken();
    if (!token) return;
    await Promise.all(
      walletIds.map((id) =>
        fetch(`/api/wallets/${id}/balance`, {
          headers: { Authorization: `Bearer ${token}` },
        }).catch(() => null),
      ),
    );
    void queryClient.invalidateQueries({ queryKey: ['wallets-my'] });
  }, [enabled, walletIds, getAccessToken, queryClient]);

  useEffect(() => {
    if (!enabled || walletIds.length === 0) return;

    const onEvent = () => void refreshAll();
    const onFocus = () => void refreshAll();
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshAll();
    };

    window.addEventListener(POINTER_WALLET_BALANCE_REFRESH_EVT, onEvent);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);

    return () => {
      window.removeEventListener(POINTER_WALLET_BALANCE_REFRESH_EVT, onEvent);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [enabled, walletIds.length, refreshAll]);
}
