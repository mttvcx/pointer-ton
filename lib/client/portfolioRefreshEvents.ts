/** Fired after trades, transfers, or wallet mutations — replaces portfolio polling loops. */
export const POINTER_PORTFOLIO_REFRESH_EVT = 'pointer:portfolio-refresh';

/** Fired when on-chain wallet balances should refresh (no interval polling). */
export const POINTER_WALLET_BALANCE_REFRESH_EVT = 'pointer:wallet-balance-refresh';

export type PortfolioRefreshDetail = { reason?: string };

export function dispatchPortfolioRefresh(detail?: PortfolioRefreshDetail): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(POINTER_PORTFOLIO_REFRESH_EVT, { detail: detail ?? {} }));
}

export function dispatchWalletBalanceRefresh(): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(POINTER_WALLET_BALANCE_REFRESH_EVT));
}

/** Call after portfolio + wallet balance query invalidations. */
export function dispatchSolanaAccountRefresh(reason?: string): void {
  dispatchPortfolioRefresh({ reason });
  dispatchWalletBalanceRefresh();
}
