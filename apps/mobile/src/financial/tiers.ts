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
  annualFee: number;
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
    monthlyLimit: 2_000,
    cashbackCredit: 0.5,
    cashbackCash: 0.25,
    concierge: null,
    loungesLabel: '—',
    loungeVisits: 0,
    fastTrack: 0,
    gradient: ['#2C6BEF', '#1E3A8A'],
    accent: '#3D8BFF',
    tagline: 'Spend without selling. Free to start.',
  },
  {
    id: 'silver',
    name: 'Silver',
    annualFee: 99,
    monthlyLimit: 20_000,
    cashbackCredit: 1,
    cashbackCash: 0.5,
    concierge: 'Standard',
    loungesLabel: '1 visit / year',
    loungeVisits: 1,
    fastTrack: 0,
    gradient: ['#C7CCD1', '#8A9099'],
    accent: '#C7CCD1',
    tagline: 'For the everyday spender.',
  },
  {
    id: 'gold',
    name: 'Gold',
    annualFee: 249,
    monthlyLimit: 200_000,
    cashbackCredit: 1.5,
    cashbackCash: 0.75,
    concierge: 'Personal',
    loungesLabel: '4 visits / year',
    loungeVisits: 4,
    fastTrack: 2,
    gradient: ['#E7C567', '#B8860B'],
    accent: '#E7C567',
    tagline: 'When your lifestyle catches up.',
  },
  {
    id: 'platinum',
    name: 'Platinum',
    annualFee: 999,
    monthlyLimit: 750_000,
    cashbackCredit: 2,
    cashbackCash: 1,
    concierge: 'VIP Priority',
    loungesLabel: 'Unlimited',
    loungeVisits: Infinity,
    fastTrack: 5,
    gradient: ['#D9DEE4', '#9BA3AD'],
    accent: '#EAEEF2',
    tagline: 'No limits. Keep your upside.',
  },
];

export const tierById = (id: TierId): Tier => TIERS.find((t) => t.id === id) ?? TIERS[0];

/* ---------------- unit economics ---------------- */

// Program-level assumptions (transparent so pricing can be defended + tuned).
const INTERCHANGE = 0.010; // net to the program after Visa/issuer split (~1.0%)
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
  revenue: { fee: number; interchange: number; borrowSpread: number; yieldSpread: number; total: number };
  cost: { cashback: number; perks: number; processing: number; total: number };
  marginUsd: number;
  marginPctOfSpend: number;
};

/** Per-member annual P&L for a tier under the assumptions above. */
export function tierEconomics(t: Tier): TierEconomics {
  const spend = ANNUAL_SPEND[t.id];
  const creditMix = CREDIT_MIX[t.id];
  const creditSpend = spend * creditMix;
  const cashSpend = spend - creditSpend;

  const interchange = spend * INTERCHANGE;
  const borrowSpread = creditSpend * BORROW_SPREAD;
  const yieldSpread = spend * 0.2 * YIELD_SPREAD; // ~20% of spend-equivalent sits idle earning
  const revenueTotal = t.annualFee + interchange + borrowSpread + yieldSpread;

  // Cashback is blended: higher rate on the credit portion, lower on cash.
  const cashback = creditSpend * (t.cashbackCredit / 100) + cashSpend * (t.cashbackCash / 100);
  const loungeVisits = Number.isFinite(t.loungeVisits) ? t.loungeVisits : LOUNGE_CAP;
  const perks = loungeVisits * LOUNGE_COST + t.fastTrack * FASTTRACK_COST + (t.concierge ? CONCIERGE_COST[t.concierge] ?? 0 : 0);
  const costTotal = cashback + perks + PROCESSING;

  return {
    annualSpend: spend,
    creditSpend,
    revenue: { fee: t.annualFee, interchange, borrowSpread, yieldSpread, total: revenueTotal },
    cost: { cashback, perks, processing: PROCESSING, total: costTotal },
    marginUsd: revenueTotal - costTotal,
    marginPctOfSpend: spend > 0 ? ((revenueTotal - costTotal) / spend) * 100 : 0,
  };
}
