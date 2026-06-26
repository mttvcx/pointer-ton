/**
 * API contracts the mobile app binds to — mirrored from the existing Pointer
 * backend (verified against live responses). When the Turborepo restructure
 * lands these move to packages/shared-types and are imported by both apps.
 */

export type TokenRow = {
  mint: string;
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
