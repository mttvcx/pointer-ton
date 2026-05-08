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
  /** Jetton master (normalized TON address). */
  mint: string;
  quote: Record<string, unknown>;
  /** Legacy Jupiter field — always null for TON. */
  swapTransaction: string | null;
  tonConnect: TonConnectTradePayload;
  lastValidBlockHeight?: number;
  presetsSol: readonly number[] | number[];
  summary: {
    amountInRaw: string;
    amountOutRaw: string | null;
    amountSolEstimate: number;
  };
};
