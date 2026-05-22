import { ALERT_TYPE_TWITTER_LISTEN } from '@/lib/alerts/alertRuleModel';

export const POINTER_AUTO_BUY_DISPATCH_EVT = 'pointer:auto-buy:dispatch';

export type AutoBuyDispatchPayload = {
  mint: string;
  ticker: string;
  amountSol: number;
  ruleId?: string | null;
  alertId?: string | null;
  /** UI dry-run — executor must not call buyToken. */
  dataDemo?: boolean;
};

export type TwitterListenAutoBuyPayload = {
  execution?: string;
  mint?: string | null;
  ruleId?: string;
  ruleName?: string;
  buySolPreset?: number | null;
  matchedPhrases?: string[];
  autoHeldReason?: string | null;
};

export function parseTwitterListenAutoBuyPayload(payload: unknown): TwitterListenAutoBuyPayload | null {
  if (!payload || typeof payload !== 'object') return null;
  return payload as TwitterListenAutoBuyPayload;
}

export function isAutoBuyTwitterListenAlert(type: string, payload: unknown): boolean {
  if (type !== ALERT_TYPE_TWITTER_LISTEN) return false;
  const p = parseTwitterListenAutoBuyPayload(payload);
  if (!p || p.execution !== 'auto_buy') return false;
  const mint = typeof p.mint === 'string' ? p.mint.trim() : '';
  return mint.length > 0;
}

export function tickerFromTwitterListenPayload(p: TwitterListenAutoBuyPayload, mint: string): string {
  const first = p.matchedPhrases?.[0]?.trim();
  if (first && first.length <= 12) return first.toUpperCase();
  if (mint.length >= 4) return mint.slice(0, 4).toUpperCase();
  return 'TOKEN';
}

/** Demo mint for settings dry-run — never sent to chain. */
export const AUTO_BUY_DEMO_MINT = 'DemoMint11111111111111111111111111111111';

export function dispatchAutoBuyEvent(detail: AutoBuyDispatchPayload): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(new CustomEvent(POINTER_AUTO_BUY_DISPATCH_EVT, { detail }));
}
