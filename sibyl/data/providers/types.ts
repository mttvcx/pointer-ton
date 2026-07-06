/**
 * Provider contract. Agents NEVER import a provider directly — they pull from the
 * registry, so a provider can be swapped, mocked, or key-gated without touching
 * agent logic. Every provider declares its env vars + mock behaviour.
 */

export type ProviderStatus = {
  name: string;
  /** Real API reachable (keys present). */
  configured: boolean;
  /** Env var names an operator sets to go live. */
  envVars: string[];
  note: string;
};

export type MarketFacts = {
  symbol: string | null;
  name: string | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  change24hPct: number | null;
  ageLabel: string | null;
  protocol: string | null;
  imageUrl: string | null;
  source: string;
};

export type HolderFacts = {
  top10Pct: number | null;
  holders: { rank: number; address: string; pct: number; label?: string | null; isKol?: boolean }[];
  source: string;
};

export type LabeledWallet = { address: string; label: string; kind: 'kol' | 'smart' | 'insider' | 'scam' | 'unknown'; handle?: string | null; pnlUsd?: number | null };

export type KOLMention = { handle: string; name: string; note: string; at?: string | null; url?: string | null };

/** A specific tweet Sibyl cites (origin of a meta, the post carrying a run, etc.). */
export type TweetRef = { url: string; handle?: string | null; note?: string | null };

export type SocialFacts = {
  velocity: 'rising' | 'flat' | 'falling' | 'unknown';
  handleCount: number;
  window: string;
  mentions: KOLMention[];
  /** Actual tweets driving the token — rendered with a hover preview. */
  tweets?: TweetRef[];
  source: string;
};

export type NarrativeFacts = {
  name: string;
  stage: 'early' | 'mid' | 'late' | 'unknown';
  origin: string | null;
  /** The tweet that kicked the meta off, when identifiable. */
  originTweetUrl?: string | null;
  strengthening: boolean | null;
  spread: { x?: number; tiktok?: number; reels?: number; news?: number; telegram?: number };
  summary: string;
  source: string;
};

export type DuneFacts = { title: string; rows: { label: string; value: string }[]; queryUrl: string | null; source: string };
