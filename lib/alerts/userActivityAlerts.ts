import type { AppChainId } from '@/lib/chains/appChain';

/** Persists to `alerts.type` — shown in co-pilot Activity + `/api/alerts/ticker`. */
export const ALERT_TYPE_USER_TRADE = 'user_trade' as const;

export type UserTradeKind =
  | 'auto_buy'
  | 'auto_sell'
  | 'pulse_quick_buy'
  | 'pulse_quick_sell'
  | 'token_panel_buy'
  | 'token_panel_sell'
  | 'spot_buy'
  | 'spot_sell_pct'
  | 'spot_sell_sol_out';

export type UserTradeAlertPayload = {
  kind: UserTradeKind;
  mint: string;
  chain: AppChainId;
  /** Native spent (buy) or received estimate (sell), when known */
  amountSol?: number;
  /** Percent of balance sold (quick sell / spot pct path) */
  sellPct?: number;
  txSignature?: string | null;
};
