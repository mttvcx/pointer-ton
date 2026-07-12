/** Normalized quote response from `POST /api/trade/quote` (STON.fi + TonConnect). */

import type { EvmSwapQuote } from '@/lib/evm/evmSwapQuote';
import type { EvmTradeChain } from '@/lib/evm/evmTradeChains';

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
  /** `sol` → Jupiter+Privy Solana; `ton` → TonConnect; `evm` → LiFi + Privy EVM wallet. */
  chain?: 'ton' | 'sol' | 'evm';
  /** EVM swap payload (client executes via the user's Privy EVM wallet). */
  evm?: (EvmSwapQuote & { appChain: EvmTradeChain }) | null;
  quote: Record<string, unknown>;
  /** Jupiter unsigned swap tx (base64) when `chain === 'sol'`. */
  swapTransaction: string | null;
  /** TonConnect payload when `chain === 'ton'` (or omitted). */
  tonConnect: TonConnectTradePayload | null;
  lastValidBlockHeight?: number;
  presetsSol: readonly number[] | number[];
  presetsUsdc?: readonly number[] | number[];
  /** Input spend asset for Solana buys (`sol` default). */
  spendAsset?: 'sol' | 'usdc';
  summary: {
    amountInRaw: string;
    amountOutRaw: string | null;
    amountSolEstimate: number;
    amountUsdcEstimate?: number;
  };
};
