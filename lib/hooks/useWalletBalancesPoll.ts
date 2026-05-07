'use client';

import { useCallback, useEffect } from 'react';
import type { QueryClient } from '@tanstack/react-query';

/**
 * Refreshes on-chain SOL balances into `user_wallets` on an interval and when the tab regains focus.
 * Phase 4 Step 10 - replaces a manual per-wallet refresh button.
 */
export function useWalletBalancesPoll(opts: {
  enabled: boolean;
  walletIds: string[];
  getAccessToken: () => Promise<string | null>;
  queryClient: QueryClient;
  /** Default 30s */
  intervalMs?: number;
}) {
  const {
    enabled,
    walletIds,
    getAccessToken,
    queryClient,
    intervalMs = 30_000,
  } = opts;

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
    const id = window.setInterval(() => void refreshAll(), intervalMs);
    return () => window.clearInterval(id);
  }, [enabled, walletIds, intervalMs, refreshAll]);

  useEffect(() => {
    if (!enabled || walletIds.length === 0) return;
    function onVis() {
      if (document.visibilityState === 'visible') void refreshAll();
    }
    function onFocus() {
      void refreshAll();
    }
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, [enabled, walletIds.length, refreshAll]);
}
