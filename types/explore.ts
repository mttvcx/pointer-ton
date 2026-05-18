/** Explore / mindshare discovery — client-side views over Pulse token bundles. */

export type ExploreTimeWindow = '5m' | '1h' | '6h' | '24h';

export type ExploreViewMode = 'bubbles' | 'axiom';

export type ExploreSortMode =
  | 'mindshare'
  | 'wallets'
  | 'volume'
  | 'fresh_wallets'
  | 'kols'
  | 'new_pairs';

export type ConfidenceLevel = 'low' | 'medium' | 'high';

export type TrendDirection = 'rising' | 'flat' | 'falling';

/** Configurable weights — must sum to ~1 for the weighted blend (before risk). */
export type MindshareWeightConfig = {
  social: number;
  wallet: number;
  market: number;
  event: number;
  momentum: number;
  riskPenaltyMax: number;
};

export type BubbleAccent = 'bull' | 'neutral' | 'social' | 'event' | 'risk';

export type SocialCatalystType =
  | 'kol_catalyst'
  | 'viral_post'
  | 'listing_catalyst'
  | 'smart_wallet_signal'
  | 'narrative_driver'
  | 'risk_warning'
  | 'official'
  | 'other';

export interface SocialSourceItem {
  id: string;
  tokenAddress: string;
  sourceType: 'tweet' | 'news' | 'exchange' | 'project' | 'wallet_event';
  authorName: string;
  authorHandle: string | null;
  avatarUrl: string | null;
  timestamp: string | null;
  text: string;
  url: string | null;
  engagement: number | null;
  relevanceScore: number | null;
  sourceWeight: number | null;
  catalystType: SocialCatalystType;
  summary?: string;
}

export interface TokenExploreItem {
  tokenAddress: string;
  chainTicker: string;
  ticker: string;
  name: string;
  iconUrl: string | null;
  ageHours: number | null;
  ageLabel: string | null;
  marketCap: number | null;
  liquidity: number | null;
  volumeWindow: number | null;
  volume24h: number | null;
  txnsWindow: number | null;
  buySellRatio: number | null;
  priceChangePct: number | null;
  sparkline: number[] | null;
  mindshareScore: number;
  marketScore: number;
  walletScore: number;
  socialScore: number;
  eventScore: number;
  momentumScore: number;
  riskScore: number;
  confidenceLevel: ConfidenceLevel;
  trendDirection: TrendDirection;
  trackedWalletBuys: number | null;
  freshWalletBuys: number | null;
  smartWalletBuys: number | null;
  kolMentionCount: number | null;
  socialVelocity: number | null;
  topCatalysts: string[];
  topSources: SocialSourceItem[];
  reasonSummary: string;
  hoverOneLiner: string;
  bubbleAccent: BubbleAccent;
  signalBadges: ExploreSignalBadge[];
  lastUpdatedAt: string | null;
  /** Display radius in px (computed from mindshare + cohort + canvas cap). */
  displayRadius: number;
  /** Set when the Explore row is built from synthetic demo snapshots (negative snapshot id). */
  isDemoFixture?: boolean;
}

export type ExploreSignalBadge =
  | 'kol'
  | 'wallets'
  | 'fresh'
  | 'cex'
  | 'volume'
  | 'social'
  | 'listing'
  | 'risk';

export interface ExploreFilterState {
  minMcapUsd: number | null;
  maxMcapUsd: number | null;
  minLiquidityUsd: number | null;
  minVolumeUsd: number | null;
  minMindshare: number | null;
  minWalletSignal: number | null;
  maxRisk: number | null;
  excludeHighRisk: boolean;
  onlyNewPairsHours: number | null;
  onlySocialSignals: boolean;
}

export const EMPTY_EXPLORE_FILTERS: ExploreFilterState = {
  minMcapUsd: null,
  maxMcapUsd: null,
  minLiquidityUsd: null,
  minVolumeUsd: null,
  minMindshare: null,
  minWalletSignal: null,
  maxRisk: null,
  excludeHighRisk: false,
  onlyNewPairsHours: null,
  onlySocialSignals: false,
};
