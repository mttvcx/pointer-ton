/** Static presentation config for Pointer Points / campaigns UI — not authoritative scoring logic. */

export const POINTS_SEASON_LABEL = 'Season 1 — Genesis';
export const POINTS_RULES_VERSION = '2026.02';
export const POINTS_LAST_UPDATED_LABEL = 'Feb 2026';

export type RankTierId =
  | 'scout'
  | 'operator'
  | 'specialist'
  | 'elite'
  | 'champion'
  | 'legend'
  | 'founder';

export type RankTierMeta = {
  id: RankTierId;
  label: string;
  /** Minimum cumulative points to reach this tier (display heuristic). */
  minPoints: number;
};

/** Prestige ladder — thresholds are UI staging until product locks economics. */
export const RANK_LADDER: RankTierMeta[] = [
  { id: 'scout', label: 'Scout', minPoints: 0 },
  { id: 'operator', label: 'Operator', minPoints: 25_000 },
  { id: 'specialist', label: 'Specialist', minPoints: 125_000 },
  { id: 'elite', label: 'Elite', minPoints: 500_000 },
  { id: 'champion', label: 'Champion', minPoints: 2_000_000 },
  { id: 'legend', label: 'Legend', minPoints: 8_000_000 },
  { id: 'founder', label: 'Founder', minPoints: 35_000_000 },
];

export function rankTierFromPoints(totalPoints: number): {
  tier: RankTierMeta;
  next: RankTierMeta | null;
  /** Progress toward next tier, 0–1 (1 = at or past next threshold). */
  progressToNext: number;
} {
  let idx = 0;
  for (let i = RANK_LADDER.length - 1; i >= 0; i--) {
    if (totalPoints >= RANK_LADDER[i]!.minPoints) {
      idx = i;
      break;
    }
  }
  const tier = RANK_LADDER[idx]!;
  const next = RANK_LADDER[idx + 1] ?? null;
  if (!next) {
    return { tier, next: null, progressToNext: 1 };
  }
  const span = next.minPoints - tier.minPoints;
  const progress = Math.min(
    1,
    Math.max(0, span <= 0 ? 1 : (totalPoints - tier.minPoints) / span),
  );
  return { tier, next, progressToNext: progress };
}

export type EcosystemCampaignId = 'sol' | 'ton' | 'base' | 'bnb' | 'hyperliquid';

export type EcosystemCampaignCard = {
  id: EcosystemCampaignId;
  label: string;
  /** Short tagline — product-native behaviour only. */
  tagline: string;
};

/** Visual identity per ecosystem node — UI-only; not on-chain status. */
export type EcosystemNodeVisual = {
  /** Top-right status chip */
  status: string;
  /** Optional emphasis tag */
  boost?: string;
  /** Bottom-right meta chip */
  meta: string;
  /** Radial tint for card atmosphere (CSS color stops). */
  radial: string;
  /** Border / ring when selected */
  accent: string;
  /** Pulsing live indicator hue */
  liveHue: string;
};

export const ECOSYSTEM_NODE_VISUAL: Record<EcosystemCampaignId, EcosystemNodeVisual> = {
  sol: {
    status: 'Routing live',
    boost: 'Vol-weighted',
    meta: 'Season sync',
    radial: 'rgba(167,139,250,0.14)',
    accent: 'rgba(167,139,250,0.55)',
    liveHue: '#a78bfa',
  },
  ton: {
    status: 'Pulse active',
    boost: 'Native',
    meta: 'Wallet-linked',
    radial: 'rgba(0,163,224,0.16)',
    accent: 'rgba(0,163,224,0.55)',
    liveHue: '#00a3e0',
  },
  base: {
    status: 'Deployed',
    meta: 'Cross-chain',
    radial: 'rgba(94,187,255,0.12)',
    accent: 'rgba(94,187,255,0.5)',
    liveHue: '#5ebbff',
  },
  bnb: {
    status: 'Monitoring',
    meta: 'Partner routes',
    radial: 'rgba(255,181,71,0.1)',
    accent: 'rgba(255,181,71,0.45)',
    liveHue: '#ffb547',
  },
  hyperliquid: {
    status: 'Integration',
    boost: 'Perp surface',
    meta: 'High retention',
    radial: 'rgba(61,220,151,0.11)',
    accent: 'rgba(61,220,151,0.48)',
    liveHue: '#3ddc97',
  },
};

export const ECOSYSTEM_CAMPAIGNS: EcosystemCampaignCard[] = [
  {
    id: 'sol',
    label: 'Solana',
    tagline: 'Trade & route volume on Solana through Pointer; referrals must trade on-chain.',
  },
  {
    id: 'ton',
    label: 'TON',
    tagline: 'Pulse & terminal usage on TON — native routing and wallet-linked activity.',
  },
  {
    id: 'base',
    label: 'Base',
    tagline: 'Cross-chain exploration — ecosystem quests reward terminal usage, not noise.',
  },
  {
    id: 'bnb',
    label: 'BNB Chain',
    tagline: 'Aligned incentives with discovery and execution — no engagement farming.',
  },
  {
    id: 'hyperliquid',
    label: 'Hyperliquid',
    tagline: 'Where integrations land — volume and retention tracked with disclosure.',
  },
];

export const SOCIAL_IDENTITY_COPY =
  'Link X / Discord / Telegram for verification, badges, and curated programs. Pointer does not award points for posting or replies — we avoid InfoFi spam incentives.';

export const CREATOR_PROGRAM_COPY =
  'Creator & operator seats are application-only. Attribution uses referral links and on-chain volume — not automated “tweet = points”.';

export const TRANSPARENCY_BULLETS = [
  'Rules and pools publish per season; economics ship with disclosure.',
  'Leaderboards separate traders, referrers, and creators where applicable.',
  'Anti-sybil uses wallet graph + linked identities — not reply counts.',
];
