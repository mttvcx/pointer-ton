/** Normalized quote response from `POST /api/trade/quote` (STON.fi + TonConnect). */

export type TonConnectTradePayload = {
  validUntil: number;
  messages: Array<{
    address: string;
    amount: string;
    payload?: string;
  }>;
};

export type TradeQuoteApiOk = {
  side: 'buy' | 'sell';
  /** Jetton master or SPL mint (normalized for chain). */
  mint: string;
  /** When `sol`, quote uses Jupiter + Privy Solana signing — not TonConnect. */
  chain?: 'ton' | 'sol';
  quote: Record<string, unknown>;
  /** Jupiter unsigned swap tx (base64) when `chain === 'sol'`. */
  swapTransaction: string | null;
  /** TonConnect payload when `chain === 'ton'` (or omitted). */
  tonConnect: TonConnectTradePayload | null;
  lastValidBlockHeight?: number;
  presetsSol: readonly number[] | number[];
  summary: {
    amountInRaw: string;
    amountOutRaw: string | null;
    amountSolEstimate: number;
  };
};
