'use client';

import { useQuery } from '@tanstack/react-query';
import {
  fetchWalletNativeBalance,
  walletNativeBalanceQueryKey,
} from '@/lib/wallet/fetchWalletNativeBalance';
import { parseLamportsStringToSol } from '@/lib/utils/formatters';

/** Live native balance for one wallet row — shared cache with balance poll. */
export function useWalletNativeBalance(opts: {
  enabled: boolean;
  walletId: string | null | undefined;
  /** DB row balance shown instantly while RPC fetch is in flight. */
  fallbackLamports?: string | null;
  getAccessToken: () => Promise<string | null>;
}) {
  const { enabled, walletId, fallbackLamports, getAccessToken } = opts;
  const fallbackUi = parseLamportsStringToSol(fallbackLamports ?? null);

  return useQuery({
    queryKey: walletId ? walletNativeBalanceQueryKey(walletId) : ['wallet-native-balance', 'none'],
    queryFn: () => fetchWalletNativeBalance(walletId!, getAccessToken),
    enabled: enabled && Boolean(walletId),
    staleTime: 8_000,
    refetchOnMount: 'always',
    refetchOnWindowFocus: true,
    retry: 2,
    placeholderData:
      fallbackLamports != null && fallbackUi != null
        ? { lamports: fallbackLamports, ui: fallbackUi }
        : undefined,
  });
}
