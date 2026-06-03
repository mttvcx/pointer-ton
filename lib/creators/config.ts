import { z } from 'zod';

export const CreatorPlatformSchema = z.enum(['tiktok', 'instagram', 'x']);
export type CreatorPlatform = z.infer<typeof CreatorPlatformSchema>;

export const CreatorTierSchema = z.enum(['basic', 'elite']);
export type CreatorTier = z.infer<typeof CreatorTierSchema>;

export const TIER1_COUNTRIES_BASIC = [
  'US', 'CA', 'GB', 'AU', 'DE', 'FR', 'NL', 'SE', 'DK', 'CH', 'NZ',
] as const;

/** Milestone payouts in USD cents per tier */
export const CREATOR_TIER_OFFERS = {
  basic: {
    id: 'basic' as const,
    label: 'BASIC',
    tier1MinPct: 20,
    countries: TIER1_COUNTRIES_BASIC,
    countryLabel: '20% Tier-1 audience',
    milestones: [
      { views: 40_000, usdCents: 2_000 },
      { views: 500_000, usdCents: 3_000 },
      { views: 1_000_000, usdCents: 5_000 },
    ],
    maxPerVideoUsdCents: 10_000,
  },
  elite: {
    id: 'elite' as const,
    label: 'ELITE',
    tier1MinPct: 40,
    countries: ['US'] as const,
    countryLabel: '40% USA audience',
    milestones: [
      { views: 40_000, usdCents: 2_000 },
      { views: 100_000, usdCents: 3_000 },
      { views: 500_000, usdCents: 10_000 },
      { views: 1_000_000, usdCents: 15_000 },
    ],
    maxPerVideoUsdCents: 30_000,
  },
} as const;

export function currentMonthKey(d = new Date()): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function monthSubmissionDeadline(d = new Date()): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

export function normalizePostUrl(raw: string): string {
  try {
    const u = new URL(raw.trim());
    u.hash = '';
    u.search = '';
    let path = u.pathname.replace(/\/+$/, '');
    if (path.endsWith('/video')) path = path.slice(0, -6);
    return `${u.hostname.toLowerCase()}${path}`.toLowerCase();
  } catch {
    return raw.trim().toLowerCase();
  }
}

export function detectPlatformFromUrl(url: string): CreatorPlatform | null {
  const lo = url.toLowerCase();
  if (lo.includes('tiktok.com') || lo.includes('vm.tiktok')) return 'tiktok';
  if (lo.includes('instagram.com') || lo.includes('instagr.am')) return 'instagram';
  if (lo.includes('twitter.com') || lo.includes('x.com')) return 'x';
  return null;
}

/** Compute earnings from verified view count and tier milestones */
export function computeEarningsUsdCents(views: number, tier: CreatorTier): number {
  const offer = CREATOR_TIER_OFFERS[tier];
  let total = 0;
  for (const m of offer.milestones) {
    if (views >= m.views) total += m.usdCents;
  }
  return Math.min(total, offer.maxPerVideoUsdCents);
}
