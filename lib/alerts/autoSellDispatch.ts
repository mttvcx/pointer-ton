export const POINTER_AUTO_SELL_DISPATCH_EVT = 'pointer:auto-sell:dispatch';

export type AutoSellDispatchPayload = {
  mint: string;
  ticker?: string;
  sellPct: number;
  ruleId?: string | null;
  /** Dry-run — toast only, no swap. */
  dataDemo?: boolean;
};

export function dispatchAutoSellEvent(detail: AutoSellDispatchPayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<AutoSellDispatchPayload>(POINTER_AUTO_SELL_DISPATCH_EVT, { detail }),
  );
}

/** Demo mint — no real swap. */
export const AUTO_SELL_DEMO_MINT = 'DemoAutoSell1111111111111111111111111111111';
