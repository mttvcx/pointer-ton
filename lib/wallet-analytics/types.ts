import type { AppChainId } from '@/lib/chains/appChain';

export type WalletAnalyticsTimeframe = '1d' | '7d' | '30d' | 'max';

export type WalletAnalyticsChartPoint = {
  t: number;
  v: number;
};

export type WalletPositionRow = {
  mint: string;
  symbol: string;
  name: string | null;
  imageUrl: string | null;
  decimals: number;
  chain: AppChainId;
  boughtUsd: number | null;
  boughtTokenUi: number | null;
  /** Optional txn counts for desk-style columns */
  boughtTxnCount?: number | null;
  soldUsd: number | null;
  soldTokenUi: number | null;
  soldTxnCount?: number | null;
  remainingUsd: number | null;
  remainingTokenUi: number | null;
  pnlUsd: number | null;
  pnlPct: number | null;
  /** e.g. "9h", "3d" */
  lastActivityLabel?: string | null;
};

export type WinLossBucketId =
  | 'gt500'
  | '200to500'
  | '0to200'
  | '0toNeg50'
  | 'ltNeg50'
  /** Honest aggregate buckets when only win-rate totals are indexed. */
  | 'wins'
  | 'losses';

export type WinLossBucket = {
  id: WinLossBucketId;
  label: string;
  count: number;
  tone: 'bull' | 'bear';
};

export type WalletFundingInfo = {
  /** Wallet / program that funded this account (display + explorer target when not a tx). */
  fromAddress: string;
  /** Solana transaction signature → Solscan “tx” view */
  fundingTxSignature: string | null;
  amountSol: number | null;
  /** Window label, e.g. match selected timeframe “7d” */
  periodLabel: string | null;
};

export type WalletAnalyticsPayload = {
  address: string;
  chain: AppChainId;
  /** ISO timestamp of stats row when present */
  statsComputedAt: string | null;
  solLamports: string | null;
  solUsd: number | null;
  totalValueUsd: number | null;
  unrealizedPnlUsd: number | null;
  tradeableBalanceUsd: number | null;
  stableCoinBalanceUsd: number | null;
  /** Synthetic age string when derivable (SOL intelligence). */
  walletAgeLabel: string | null;
  /** Native balance line for non-SOL chains (e.g. TON ui amount). */
  nativeBalanceLabel: string | null;
  /** Primary inbound native funding (Solana heuristic). */
  funding: WalletFundingInfo | null;
  chart: WalletAnalyticsChartPoint[];
  positions: WalletPositionRow[];
  performance: {
    totalPnlUsd: number | null;
    realizedPnlUsd: number | null;
    txns: number | null;
    winRatePct: number | null;
  };
  buckets: WinLossBucket[];
};
