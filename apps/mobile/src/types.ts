/**
 * API contracts the mobile app binds to — mirrored from the existing Pointer
 * backend (verified against live responses). When the Turborepo restructure
 * lands these move to packages/shared-types and are imported by both apps.
 */

/** Chains the app trades across — one USD balance routes the buy on any of them. */
export type ChainId = 'sol' | 'eth' | 'base' | 'bnb';

export type TokenRow = {
  mint: string;
  /** Which chain this token lives on (defaults to sol when a feed omits it). */
  chain?: ChainId;
  symbol: string | null;
  name: string | null;
  decimals: number;
  image_url: string | null;
  description: string | null;
  twitter_handle: string | null;
  telegram_url: string | null;
  website_url: string | null;
  creator_wallet: string | null;
  launch_pad: string | null;
  raw_metadata: unknown;
  is_lp_locked: boolean | null;
  mint_authority: string | null;
  freeze_authority: string | null;
  bonding_progress: number | null;
  created_at: string | null;
};

export type TokenSnapshot = {
  market_cap_usd: number | null;
  price_usd: number | null;
  liquidity_usd: number | null;
  volume_24h_usd: number | null;
  holder_count: number | null;
  top10_holder_pct: number | null;
  dev_holding_pct: number | null;
  extended_metrics: unknown;
  snapshot_at: string | null;
} | null;

export type PulseBundle = { token: TokenRow; snapshot: TokenSnapshot };
export type PulseFeed = { column: string; chain: string; items: PulseBundle[]; warning?: string };

export type TokenDetail = { token: TokenRow; snapshot: TokenSnapshot; dev: unknown };

/* ---------- authed account shapes (mirror the web /api responses) ---------- */

/** GET /api/me → { user } */
export type MeUser = {
  id: string;
  privyId: string;
  walletAddress: string | null;
  email: string | null;
  username: string | null;
  tierId: string;
  createdAt: string;
  onboardingCompletedAt: string | null;
  onboardingStep: number;
};

/** GET /api/wallets/my → { wallets: [...] } */
export type MyWallet = {
  id: string;
  label: string;
  wallet_address: string;
  is_primary: boolean;
  slot: number;
  is_archived: boolean;
  is_active: boolean;
  is_imported: boolean;
  /** SOL balance in lamports (decimal string). */
  balance_lamports: string | null;
  balance_updated_at: string;
  created_at: string;
};

export type PortfolioPosition = {
  mint: string;
  balanceRaw: string;
  decimals: number;
  symbol: string | null;
  imageUrl: string | null;
  costBasisUsd: number;
  valueUsd: number;
  unrealizedPnlUsd: number;
};

export type PortfolioSummary = {
  totalValue: number;
  costBasis: number;
  unrealizedPnl: number;
  unrealizedPnlPct: number;
  realizedPnl: number;
};

/** GET /api/portfolio → aggregate holdings + PnL for a wallet. */
export type Portfolio = {
  walletAddress: string | null;
  solLamports: string | null;
  solUsd: number;
  summary: PortfolioSummary;
  positions: PortfolioPosition[];
};

/** GET /api/points/me → points balance + rank. */
export type PointsSummary = {
  totalPoints: number;
  breakdown: { source: string; total: number }[];
  rank: number | null;
};

/** /api/ai/explain-token → { data: ExplainTokenOutput, ... } */
export type ExplainTokenOutput = {
  summary: string;
  bullCase: string[];
  bearCase: string[];
  riskFlags: string[];
  confidence: 'low' | 'medium' | 'high';
};
export type ExplainTokenResponse = {
  data: ExplainTokenOutput;
  cacheHit?: boolean;
  fromCache?: boolean;
  modelUsed?: string;
  costUsd?: number;
};

/** Derived 3-state safety verdict for the buy screen (computed from riskFlags). */
export type Verdict = 'healthy' | 'caution' | 'high_risk';

export type PulseColumn = 'new' | 'stretch' | 'migrated';

/** /api/perps/markets → { markets: PerpMarket[] } — Hyperliquid-backed, read-only. */
export type PerpMarket = {
  id: string;
  coin: string;
  label: string;
  iconSrc: string;
  tvSymbol: string;
  mark: number;
  oraclePx: number;
  chg24: number;
  fundingHourly: number;
  fundingApr: number;
  fundingCountdown: string;
  oiUsd: number;
  vol24Usd: number;
  maxLeverage: number;
};
