/**
 * Pointer Card — membership tiers + the unit economics behind the pricing.
 *
 * The pricing isn't vibes: cashback is funded by (interchange + the crypto-borrow
 * spread), NOT by the annual fee. The fee covers perks + overhead. This is exactly
 * why a 2% cashback Platinum can be profitable — Credit-mode spend carries a
 * borrow spread (we lend USDC against your SOL/ETH/BTC at a margin over Kamino),
 * and cashback is HIGHER in Credit mode because that's where the spread lives
 * (mirrors the "double cashback in Credit mode" model). `tierEconomics()` computes
 * the real per-member annual margin so no tier is a loss leader by accident.
 */

export type TierId = 'basic' | 'silver' | 'gold' | 'platinum';

export type Tier = {
  id: TierId;
  name: string;
  annualFee: number; // kept at 0 — tiers are earned by usage, not bought
  /** Unlock gate: 30-day trading volume (terminal + mobile) OR PTR Points. The
   *  idea — an active trader already pays us fees, so their card tier is funded by
   *  that volume, not a subscription. No token yet, so volume/points is the gate. */
  volumeReq: number; // 30-day USD volume to unlock
  pointsReq: number; // …or this many PTR Points (loyalty path)
  monthlyLimit: number;
  /** Cashback % in Credit mode (funded by interchange + borrow spread). */
  cashbackCredit: number;
  /** Cashback % in Cash mode (funded by interchange only → ~half). */
  cashbackCash: number;
  concierge: string | null;
  loungesLabel: string;
  loungeVisits: number; // per year; Infinity = unlimited
  fastTrack: number; // per year
  /** Card face gradient + accent (matches the metal-tier look). */
  gradient: [string, string];
  accent: string;
  tagline: string;
};

export const TIERS: Tier[] = [
  {
    id: 'basic',
    name: 'Basic',
    annualFee: 0,
    volumeReq: 0,
    pointsReq: 0,
    monthlyLimit: 2_000,
    cashbackCredit: 0.5,
    cashbackCash: 0.25,
    concierge: null,
    loungesLabel: '—',
    loungeVisits: 0,
    fastTrack: 0,
    // Brushed gunmetal — the entry metal (no blue; the finance section is silver).
    gradient: ['#9AA2AD', '#5C636E'],
    accent: '#D7DCE2',
    tagline: 'Spend without selling. Free to start.',
  },
  {
    id: 'silver',
    name: 'Silver',
    annualFee: 0,
    volumeReq: 25_000,
    pointsReq: 10_000,
    monthlyLimit: 20_000,
    cashbackCredit: 1,
    cashbackCash: 0.5,
    concierge: 'Standard',
    loungesLabel: '1 visit / year',
    loungeVisits: 1,
    fastTrack: 0,
    // Polished chrome — the brightest silver.
    gradient: ['#EDF1F5', '#AEB7C2'],
    accent: '#EFF3F8',
    tagline: 'For the everyday spender.',
  },
  {
    id: 'gold',
    name: 'Gold',
    annualFee: 0,
    volumeReq: 250_000,
    pointsReq: 75_000,
    monthlyLimit: 200_000,
    cashbackCredit: 1.5,
    cashbackCash: 0.75,
    concierge: 'Personal',
    loungesLabel: '4 visits / year',
    loungeVisits: 4,
    fastTrack: 2,
    // Champagne gold — warm metal, still in the metal family.
    gradient: ['#EAD08A', '#B8860B'],
    accent: '#F0D486',
    tagline: 'When your lifestyle catches up.',
  },
  {
    id: 'platinum',
    name: 'Platinum',
    annualFee: 0,
    volumeReq: 1_000_000,
    pointsReq: 300_000,
    monthlyLimit: 750_000,
    cashbackCredit: 2,
    cashbackCash: 1,
    concierge: 'VIP Priority',
    loungesLabel: 'Unlimited',
    loungeVisits: Infinity,
    fastTrack: 5,
    // Obsidian graphite with an icy sheen — the darkest, top metal.
    gradient: ['#454B54', '#16191E'],
    accent: '#E6EBF0',
    tagline: 'No limits. Keep your upside.',
  },
];

export const tierById = (id: TierId): Tier => TIERS.find((t) => t.id === id) ?? TIERS[0];

/** Unlocked if the user's 30-day volume OR PTR Points clear the tier's gate. */
export function tierUnlocked(t: Tier, volume30d: number, points: number): boolean {
  return volume30d >= t.volumeReq || points >= t.pointsReq;
}

/** Highest tier the user has earned (TIERS is ordered basic → platinum). */
export function highestUnlockedTier(volume30d: number, points: number): TierId {
  let best: TierId = 'basic';
  for (const t of TIERS) if (tierUnlocked(t, volume30d, points)) best = t.id;
  return best;
}

/** Progress toward a tier (0..1) on whichever path — volume or points — is closer. */
export function tierProgress(t: Tier, volume30d: number, points: number): number {
  const vol = t.volumeReq > 0 ? volume30d / t.volumeReq : 1;
  const pts = t.pointsReq > 0 ? points / t.pointsReq : 1;
  return Math.max(0, Math.min(1, Math.max(vol, pts)));
}

/* ---------------- unit economics ---------------- */

// Program-level assumptions (transparent so pricing can be defended + tuned).
const INTERCHANGE = 0.010; // net to the program after Visa/issuer split (~1.0%)
const TRADING_FEE_NET = 0.0015; // net Pointer take per $ of trading volume, after cashback/routing
const BORROW_SPREAD = 0.020; // effective margin over Kamino on credit-mode spend
const YIELD_SPREAD = 0.003; // small cut on idle collateral swept to yield
const PROCESSING = 12; // KYC + issuing + support, per active member / yr
const LOUNGE_COST = 32; // wholesale per lounge visit
const FASTTRACK_COST = 10; // per fast-track use
const CONCIERGE_COST: Record<string, number> = { Standard: 20, Personal: 60, 'VIP Priority': 150 };
// Realistic annual card spend per tier (a fraction of the limit — nobody maxes it).
const ANNUAL_SPEND: Record<TierId, number> = { basic: 6_000, silver: 36_000, gold: 180_000, platinum: 600_000 };
// Share of spend that runs through Credit mode (borrowed) — richer tiers lever more.
const CREDIT_MIX: Record<TierId, number> = { basic: 0.35, silver: 0.5, gold: 0.6, platinum: 0.65 };
const LOUNGE_CAP = 10; // cost cap for "unlimited" tiers

export type TierEconomics = {
  annualSpend: number;
  creditSpend: number;
  annualTradingVolume: number;
  revenue: { tradingFees: number; interchange: number; borrowSpread: number; yieldSpread: number; total: number };
  cost: { cashback: number; perks: number; processing: number; total: number };
  marginUsd: number;
  marginPctOfSpend: number;
};

/** Per-member annual P&L. There's NO subscription fee — the perks are funded by
 *  the trading fees an active user already generates (30-day gate × 12), plus card
 *  interchange + the credit-mode borrow spread. This is why usage-gated tiers are
 *  MORE profitable than a flat fee: a higher tier means more volume = more fees. */
export function tierEconomics(t: Tier): TierEconomics {
  const spend = ANNUAL_SPEND[t.id];
  const creditMix = CREDIT_MIX[t.id];
  const creditSpend = spend * creditMix;
  const cashSpend = spend - creditSpend;

  // A tier-holder sustains ~its 30-day volume gate → annualize it for fee revenue.
  const annualTradingVolume = t.volumeReq * 12;
  const tradingFees = annualTradingVolume * TRADING_FEE_NET;

  const interchange = spend * INTERCHANGE;
  const borrowSpread = creditSpend * BORROW_SPREAD;
  const yieldSpread = spend * 0.2 * YIELD_SPREAD; // ~20% of spend-equivalent sits idle earning
  const revenueTotal = tradingFees + interchange + borrowSpread + yieldSpread;

  // Cashback is blended: higher rate on the credit portion, lower on cash.
  const cashback = creditSpend * (t.cashbackCredit / 100) + cashSpend * (t.cashbackCash / 100);
  const loungeVisits = Number.isFinite(t.loungeVisits) ? t.loungeVisits : LOUNGE_CAP;
  const perks = loungeVisits * LOUNGE_COST + t.fastTrack * FASTTRACK_COST + (t.concierge ? CONCIERGE_COST[t.concierge] ?? 0 : 0);
  const costTotal = cashback + perks + PROCESSING;

  return {
    annualSpend: spend,
    creditSpend,
    annualTradingVolume,
    revenue: { tradingFees, interchange, borrowSpread, yieldSpread, total: revenueTotal },
    cost: { cashback, perks, processing: PROCESSING, total: costTotal },
    marginUsd: revenueTotal - costTotal,
    marginPctOfSpend: spend > 0 ? ((revenueTotal - costTotal) / spend) * 100 : 0,
  };
}
