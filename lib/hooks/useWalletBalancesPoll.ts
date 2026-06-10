'use client';

import { useCallback, useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';
import { POINTER_WALLET_BALANCE_REFRESH_EVT } from '@/lib/client/portfolioRefreshEvents';
import {
  fetchWalletNativeBalance,
  walletNativeBalanceQueryKey,
} from '@/lib/wallet/fetchWalletNativeBalance';

/**
 * On-chain balance refresh for embedded / linked wallet rows.
 * Event-driven by default; optional interval while the tab is visible (incoming transfers).
 */
export function useWalletBalancesPoll(opts: {
  enabled: boolean;
  walletIds: string[];
  getAccessToken: () => Promise<string | null>;
  queryClient: QueryClient;
  /** Poll while tab visible (ms). Omit for events + focus only. */
  intervalMs?: number;
  /** Fetch this wallet first so header chips update before the rest. */
  priorityWalletId?: string | null;
}) {
  const { enabled, walletIds, getAccessToken, queryClient, intervalMs, priorityWalletId } = opts;

  const refreshOne = useCallback(
    async (id: string) => {
      await queryClient
        .fetchQuery({
          queryKey: walletNativeBalanceQueryKey(id),
          queryFn: () => fetchWalletNativeBalance(id, getAccessToken),
          staleTime: 8_000,
        })
        .catch(() => null);
    },
    [getAccessToken, queryClient],
  );

  const refreshAll = useCallback(async () => {
    if (!enabled || walletIds.length === 0) return;
    const token = await getAccessToken();
    if (!token) return;

    const rest = walletIds.filter((id) => id !== priorityWalletId);
    if (priorityWalletId && walletIds.includes(priorityWalletId)) {
      await refreshOne(priorityWalletId);
    }
    await Promise.all(rest.map((id) => refreshOne(id)));
    void queryClient.invalidateQueries({ queryKey: ['wallets-my'] });
    void queryClient.invalidateQueries({ queryKey: ['portfolio'] });
  }, [enabled, walletIds, getAccessToken, priorityWalletId, refreshOne, queryClient]);

  useEffect(() => {
    if (!enabled || walletIds.length === 0) return;

    void refreshAll();

    const onEvent = () => void refreshAll();
    const onFocus = () => void refreshAll();
    const onVis = () => {
      if (document.visibilityState === 'visible') void refreshAll();
    };

    window.addEventListener(POINTER_WALLET_BALANCE_REFRESH_EVT, onEvent);
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVis);

    const interval =
      intervalMs != null && intervalMs > 0
        ? window.setInterval(() => {
            if (document.visibilityState === 'visible') void refreshAll();
          }, intervalMs)
        : undefined;

    return () => {
      window.removeEventListener(POINTER_WALLET_BALANCE_REFRESH_EVT, onEvent);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVis);
      if (interval != null) window.clearInterval(interval);
    };
  }, [enabled, walletIds.length, refreshAll, intervalMs]);
}
