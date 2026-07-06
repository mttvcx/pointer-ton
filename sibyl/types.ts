/**
 * Sibyl — shared domain types. Framework-free so the API, agents, and UI share
 * one contract. Sibyl is a crypto-intelligence engine (CT + Solana memecoins +
 * KOL wallets + narratives), NOT a general chatbot.
 */

/** Compute tier for a query. Cost + latency scale up the list. */
export type ScanMode = 'HOVER_FAST' | 'QUICK_SCAN' | 'STANDARD_SCAN' | 'DEEP_SCAN' | 'RESEARCH_REPORT';

export type PlanTier = 'FREE' | 'PRO' | 'PRO_PLUS' | 'MAX' | 'ENTERPRISE';

export type AgentName =
  | 'market'
  | 'wallet'
  | 'narrative'
  | 'social'
  | 'risk'
  | 'dune'
  | 'analog'
  | 'judge';

/** What the user asked for, normalized. */
export type SibylIntent = {
  /** Free-text query. */
  query: string;
  /** Resolved subject if we found one. */
  subject: {
    kind: 'token' | 'wallet' | 'person' | 'narrative' | 'market_question' | 'unknown';
    /** Mint / wallet address / handle / meta name. */
    ref: string | null;
    chain?: 'sol' | 'eth' | 'base' | 'bnb';
  };
  mode: ScanMode;
  /** Which specialist agents this plan should run. */
  agents: AgentName[];
};

/** A clickable entity Sibyl surfaced (KOL, wallet, token, narrative…). */
export type SibylEntityRef = {
  kind: 'person' | 'wallet' | 'token' | 'narrative' | 'group' | 'dune';
  id: string;
  label: string;
  /** X/Twitter handle (no @) when known → name renders blue + links out. */
  handle?: string | null;
  /** Solana address for wallet/token. */
  address?: string | null;
  href?: string | null;
};

/** Discriminated card spec — the right panel + inline chat render these. */
export type SibylCard =
  | { type: 'token'; id: string; data: TokenCardData }
  | { type: 'chart'; id: string; data: ChartCardData }
  | { type: 'holders'; id: string; data: HolderTableData }
  | { type: 'wallet'; id: string; data: WalletCardData }
  | { type: 'kol'; id: string; data: KOLCardData }
  | { type: 'narrative'; id: string; data: NarrativeCardData }
  | { type: 'dune'; id: string; data: DuneMetricData }
  | { type: 'risk'; id: string; data: RiskScoreData }
  | { type: 'social'; id: string; data: SocialVelocityData }
  | { type: 'timeline'; id: string; data: TimelineData }
  | { type: 'similar'; id: string; data: SimilarTokensData }
  | { type: 'table'; id: string; data: TableCardData };

export type TokenCardData = {
  mint: string;
  symbol: string | null;
  name: string | null;
  imageUrl?: string | null;
  priceUsd: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  volume24hUsd: number | null;
  change24hPct: number | null;
  ageLabel?: string | null;
  protocol?: string | null;
};

export type ChartCardData = { mint: string; symbol: string | null; tf: string; source: string; points?: number[] | null };
/** Generic inline table so the model / agents can render tabular answers in-chat. */
export type TableCardData = { title?: string | null; columns: string[]; rows: (string | number)[][]; note?: string | null };
export type HolderRow = { rank: number; address: string; pct: number; label?: string | null; isKol?: boolean };
export type HolderTableData = { mint: string; top10Pct: number | null; rows: HolderRow[] };
export type WalletCardData = {
  address: string;
  label?: string | null;
  pnlUsd?: number | null;
  holdingPct?: number | null;
  tags?: string[];
};
export type KOLCardData = { handle: string; name: string; avatarUrl?: string | null; note?: string | null; inThisTrade?: boolean };
export type NarrativeCardData = {
  name: string;
  stage: 'early' | 'mid' | 'late' | 'unknown';
  origin?: string | null;
  spread: { x?: number; tiktok?: number; reels?: number; news?: number; telegram?: number };
  strengthening: boolean | null;
  summary: string;
};
export type DuneMetricData = { title: string; rows: { label: string; value: string }[]; queryUrl?: string | null };
export type RiskScoreData = { score: number; flags: { label: string; severity: 'low' | 'med' | 'high' }[] };
export type SocialVelocityData = { handleCount: number; velocity: 'rising' | 'flat' | 'falling' | 'unknown'; window: string; kols: KOLCardData[] };
export type TimelineData = { events: { at: string; label: string }[] };
export type SimilarTokensData = { items: { symbol: string; note: string; outcome?: string | null }[] };

/** Sibyl's final answer — CT-native, short-first, then expandable sections. */
export type SibylAnswer = {
  verdict: string;
  /** 0–100. */
  confidence: number;
  why: string[];
  action: string;
  /** Long-form narration (already style-guarded). */
  body?: string | null;
  cards: SibylCard[];
  entities: SibylEntityRef[];
  sources: { label: string; url?: string | null }[];
  mode: ScanMode;
  /** Which agents actually contributed (transparency). */
  agentsRun: AgentName[];
  /** Per-agent confidence downgrades / missing data, surfaced by the judge. */
  caveats?: string[];
  /** Prior memory of this subject (the flywheel) — set when Sibyl has seen it before. */
  memory?: { seenCount: number; firstSeen: string | null } | null;
};
