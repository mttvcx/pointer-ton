'use client';

import type { QueryClient } from '@tanstack/react-query';
import { mintTradesQueryKey } from '@/lib/hooks/useMintTrades';
import { deskWalletStatsQueryKey } from '@/lib/hooks/useDeskWalletStats';
import { dispatchSolanaAccountRefresh } from '@/lib/client/portfolioRefreshEvents';

/** Invalidate token-desk queries after a successful swap (trades tape, holders, balance). */
export function invalidateTokenDeskAfterTrade(
  qc: QueryClient,
  mint: string,
  opts?: { walletAddress?: string; reason?: string },
): void {
  void qc.invalidateQueries({ queryKey: mintTradesQueryKey(mint) });
  void qc.invalidateQueries({ queryKey: ['token-holders', mint] });
  void qc.invalidateQueries({ queryKey: ['mint-top-traders', mint] });
  void qc.invalidateQueries({ queryKey: ['token-extended-metrics', mint] });
  void qc.invalidateQueries({ queryKey: ['token-metrics', mint] });
  if (opts?.walletAddress) {
    void qc.invalidateQueries({ queryKey: ['trade-balance', mint, opts.walletAddress] });
    void qc.invalidateQueries({ queryKey: deskWalletStatsQueryKey(mint, opts.walletAddress) });
  } else {
    void qc.invalidateQueries({ queryKey: ['trade-balance', mint] });
  }
  void qc.invalidateQueries({ queryKey: ['wallets-my'] });
  dispatchSolanaAccountRefresh(opts?.reason ?? 'trade');
}
