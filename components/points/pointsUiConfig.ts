/** Static presentation config for $PTR Points / campaigns UI — not authoritative scoring logic. */

export const PTR_POINTS_BRAND = '$PTR Points';
export const PTR_TICKER = '$PTR';
export const POINTS_SEASON_LABEL = 'Season 1 PTR';
export const POINTS_SEASON_SHORT = 'S1 PTR';
export const POINTS_RULES_VERSION = '2026.02';
export const POINTS_LAST_UPDATED_LABEL = 'Feb 2026';

export const PTR_HERO_TAGLINE = 'Earn from trading, referrals, and terminal usage.';

export const PTR_HERO_BODY = '';

export const PTR_SIGNIN_BLURB = 'Sign in to see your balance and rank.';

export const PTR_BENEFITS_INTRO = 'Perks unlock as you earn Season 1 $PTR.';

export const PTR_CHECKPOINT_BLURB = '';

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
  minPoints: number;
};

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
  tagline: string;
};

export type EcosystemNodeVisual = {
  status: string;
  boost?: string;
  meta: string;
  radial: string;
  accent: string;
  liveHue: string;
};

export const ECOSYSTEM_NODE_VISUAL: Record<EcosystemCampaignId, EcosystemNodeVisual> = {
  sol: {
    status: 'Live',
    boost: 'Vol',
    meta: 'S1',
    radial: 'rgba(167,139,250,0.14)',
    accent: 'rgba(167,139,250,0.55)',
    liveHue: '#a78bfa',
  },
  ton: {
    status: 'Live',
    boost: 'Native',
    meta: 'S1',
    radial: 'rgba(0,163,224,0.16)',
    accent: 'rgba(0,163,224,0.55)',
    liveHue: '#00a3e0',
  },
  base: {
    status: 'Live',
    meta: 'S1',
    radial: 'rgba(94,187,255,0.12)',
    accent: 'rgba(94,187,255,0.5)',
    liveHue: '#5ebbff',
  },
  bnb: {
    status: 'Soon',
    meta: 'S1',
    radial: 'rgba(255,181,71,0.1)',
    accent: 'rgba(255,181,71,0.45)',
    liveHue: '#ffb547',
  },
  hyperliquid: {
    status: 'Soon',
    boost: 'Perps',
    meta: 'S1',
    radial: 'rgba(61,220,151,0.11)',
    accent: 'rgba(61,220,151,0.48)',
    liveHue: '#3ddc97',
  },
};

export const ECOSYSTEM_CAMPAIGNS: EcosystemCampaignCard[] = [
  { id: 'sol', label: 'Solana', tagline: 'Trade volume on Solana.' },
  { id: 'ton', label: 'TON', tagline: 'Pulse and routing on TON.' },
  { id: 'base', label: 'Base', tagline: 'Base chain activity.' },
  { id: 'bnb', label: 'BNB Chain', tagline: 'BNB chain activity.' },
  { id: 'hyperliquid', label: 'Hyperliquid', tagline: 'Perp integrations.' },
];

export const SOCIAL_IDENTITY_COPY = 'Link socials for verification. No points for posts.';

export const CREATOR_PROGRAM_COPY = 'Creator seats are application-only.';

export const TRANSPARENCY_BULLETS = [
  'Season 1 rules publish here.',
  'Separate trader, referrer, and creator boards.',
  'Anti-sybil uses wallets and linked accounts.',
];
