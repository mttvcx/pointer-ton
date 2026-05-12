import type { AppChainId } from '@/lib/chains/appChain';
import type { MintTopTraderRow } from '@/lib/trading/mintTopTraders';
import type { TraderMintHoverStats } from '@/lib/trading/mintTopTraders';

export type KnownIdentitySource =
  | 'user_label'
  | 'tracker'
  | 'pointer_directory'
  | 'kol_feed'
  | 'admin_curated'
  | 'manual'
  | 'import';

/** High-level badges shown on chips and dossier headers. */
export type WalletIntelBadgeKind =
  | 'kol'
  | 'smart_money'
  | 'tracked'
  | 'renamed'
  | 'top_trader'
  | 'insider'
  | 'dev'
  | 'fresh'
  | 'whale'
  | 'high_win_rate'
  | 'sniper';

export interface RecognizedWalletRecord {
  address: string;
  displayName: string;
  handle?: string;
  source: KnownIdentitySource;
  /** 0–1 rough confidence for directory rows (mock / future API). */
  confidence: number;
  category: 'kol' | 'smart_money' | 'whale' | 'insider' | 'deployer' | 'sniper' | 'streamer' | 'other';
  badges: WalletIntelBadgeKind[];
  profileUrl?: string;
  avatarUrl?: string;
  notes?: string;
  firstSeenAt?: string;
  lastVerifiedAt?: string;
}

export interface WalletTokenContextView {
  tokenAddress: string;
  tokenSymbol: string;
  boughtUsd: number;
  soldUsd: number;
  realizedPnlUsd: number;
  unrealizedPnlUsd: number | null;
  remainingUsd: number | null;
  remainingPct: number | null;
  entryMarketCapUsd: number | null;
  exitMarketCapUsd: number | null;
  rank: number | null;
  firstBuyAt: string | null;
  lastActionAt: string | null;
  avgHoldDurationSec: number | null;
  isTopTrader: boolean;
  topTraderNote: string | null;
}

export interface WalletWideStatsView {
  pnl7dUsd: number;
  pnl30dUsd: number | null;
  winRate7d: number;
  tokenCount7d: number;
  txCount7d: { buy: number; sell: number };
  avgDuration7dSec: number;
  totalVolumeUsd: number;
  totalFeesUsd: number;
  trackedByCount: number;
  renamedByCount: number;
}

export interface WalletIdentityView {
  address: string;
  chain: AppChainId;
  shortAddress: string;
  displayName: string;
  handle: string | null;
  avatarUrl: string | null;
  knownIdentity: RecognizedWalletRecord | null;
  /** Best human-readable “who” line. */
  identityHeadline: string;
  identitySourceLabel: string;
  confidenceLabel: string | null;
  badges: WalletIntelBadgeKind[];
  userLabelText: string | null;
  userLabelColor: string | number | null;
  systemLabels: string[];
  groups: string[];
  tracked: boolean;
  renamed: boolean;
}

export function buildWalletTokenContextFromTraderRow(params: {
  mint: string;
  symbol: string;
  rank: number;
  row: MintTopTraderRow;
}): WalletTokenContextView {
  const { row, mint, symbol, rank } = params;
  const netHeld = Math.max(0, row.buy_token_qty - row.sell_token_qty);
  const refPx = row.avg_buy_usd_per_token ?? row.avg_sell_usd_per_token;
  const remainingUsd =
    refPx != null && netHeld > 0 ? Math.min(row.buy_usd, netHeld * refPx) : null;
  const supplyHintPct =
    netHeld > 0 && row.buy_token_qty > 0 ? (netHeld / row.buy_token_qty) * 100 : null;
  let topNote: string | null = null;
  if (row.realized_pnl_usd >= 30_000) topNote = `Realized ≥ $30k on ${symbol ?? 'token'}`;
  else if (rank <= 3 && row.realized_pnl_usd > 0) topNote = 'Top‑3 PnL on this mint';

  return {
    tokenAddress: mint,
    tokenSymbol: symbol || 'TOKEN',
    boughtUsd: row.buy_usd,
    soldUsd: row.sell_usd,
    realizedPnlUsd: row.realized_pnl_usd,
    unrealizedPnlUsd: null,
    remainingUsd,
    remainingPct: supplyHintPct,
    entryMarketCapUsd: null,
    exitMarketCapUsd: null,
    rank,
    firstBuyAt: row.first_trade_at,
    lastActionAt: row.last_trade_at,
    avgHoldDurationSec: row.held_seconds,
    isTopTrader: rank > 0 && rank <= 20,
    topTraderNote: topNote,
  };
}

export function tokenContextFromHoverStats(
  mint: string,
  symbol: string,
  stats: TraderMintHoverStats,
): WalletTokenContextView {
  return {
    tokenAddress: mint,
    tokenSymbol: symbol || 'TOKEN',
    boughtUsd: stats.buy_usd,
    soldUsd: stats.sell_usd,
    realizedPnlUsd: stats.realized_pnl_usd,
    unrealizedPnlUsd: null,
    remainingUsd: null,
    remainingPct: null,
    entryMarketCapUsd: null,
    exitMarketCapUsd: null,
    rank: null,
    firstBuyAt: stats.first_trade_at,
    lastActionAt: null,
    avgHoldDurationSec: null,
    isTopTrader: false,
    topTraderNote: null,
  };
}
