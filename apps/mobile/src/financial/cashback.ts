/**
 * Cashback enforcement — the honest engine. Given a transaction it resolves the
 * merchant CATEGORY (by MCC + name), applies the tier's boost rate UP TO the
 * monthly cap, and drops to the base rate beyond the cap. Nothing is inflated:
 * what this returns is what actually gets paid. The same math powers the demo
 * numbers and the real card settlement, so the UI never over-promises.
 */
import { useSyncExternalStore } from 'react';
import { tierById, CATEGORY_ORDER, type SpendCategory, type TierId } from './tiers';

type Cat = SpendCategory | 'base';

// AI tools have no clean MCC (they settle as generic SaaS 5734/7372), so AI is
// resolved by a merchant-NAME allowlist — we never treat all software as "AI".
const AI_MERCHANTS = ['claude', 'anthropic', 'openai', 'chatgpt', 'cursor', 'perplexity', 'midjourney', 'copilot', 'replit', 'elevenlabs', 'runway'];
const AIRLINE_MERCHANTS = ['emirates', 'british airways', 'turkish', 'delta', 'united', 'lufthansa', 'qatar', 'klm', 'ryanair', 'air canada', 'air france'];
const RIDE_MERCHANTS = ['uber', 'lyft', 'bolt', 'wheely', 'grab', 'cabify', 'ola'];

/**
 * Resolve a transaction to a boost category. MCC is authoritative for airlines
 * (3000–3350, 4511) and rides (4121); AI and demo merchants fall back to name.
 */
export function categoryForTxn(opts: { mcc?: number; merchant?: string }): Cat {
  const name = (opts.merchant ?? '').toLowerCase();
  if (AI_MERCHANTS.some((m) => name.includes(m))) return 'ai';
  const mcc = opts.mcc ?? 0;
  if ((mcc >= 3000 && mcc <= 3350) || mcc === 4511) return 'airlines';
  if (mcc === 4121) return 'rides';
  if (AIRLINE_MERCHANTS.some((m) => name.includes(m))) return 'airlines';
  if (RIDE_MERCHANTS.some((m) => name.includes(m))) return 'rides';
  return 'base';
}

export type CashbackResult = {
  category: Cat;
  mode: 'cash' | 'credit';
  amount: number;
  baseRate: number; // % that applies to everything (and to over-cap spend)
  boostRate: number; // % on this category up to the cap (0 for base)
  capMonthly: number; // 0 = uncapped (base)
  capUsedBefore: number; // boost cashback already paid in this category this month
  boostCashback: number; // boosted $ paid on this txn (after the cap)
  baseCashback: number; // base $ paid on the non-boosted part
  cashback: number; // total paid on this txn
  effectiveRate: number; // cashback / amount
  capHit: boolean; // did the cap clip this txn?
};

/**
 * Compute the cashback actually payable for one transaction. Boost applies up to
 * the remaining monthly cap; spend beyond the cap earns the base rate (not zero).
 */
export function computeCashback(o: {
  tierId: TierId;
  category: Cat;
  amount: number;
  mode: 'cash' | 'credit';
  capUsed: number;
}): CashbackResult {
  const t = tierById(o.tierId);
  const baseRate = o.mode === 'credit' ? t.cashbackCredit : t.cashbackCash;

  if (o.category === 'base') {
    const cashback = (o.amount * baseRate) / 100;
    return { category: 'base', mode: o.mode, amount: o.amount, baseRate, boostRate: 0, capMonthly: 0, capUsedBefore: 0, boostCashback: 0, baseCashback: cashback, cashback, effectiveRate: baseRate, capHit: false };
  }

  const boost = t.boosts[o.category];
  // Cash mode earns ~half the boost too (interchange-only funding on cash).
  const boostRate = o.mode === 'credit' ? boost.rate : boost.rate / 2;
  const capRemaining = Math.max(0, boost.capMonthly - o.capUsed);

  // Spend that still fits under the boost cap, at the boost rate.
  const rawBoost = (o.amount * boostRate) / 100;
  const boostCashback = Math.min(rawBoost, capRemaining);
  const boostedAmount = boostRate > 0 ? (boostCashback / boostRate) * 100 : 0;
  // The remainder (over cap) earns the base rate, not nothing.
  const overCapAmount = Math.max(0, o.amount - boostedAmount);
  const baseCashback = (overCapAmount * baseRate) / 100;
  const cashback = boostCashback + baseCashback;

  return {
    category: o.category,
    mode: o.mode,
    amount: o.amount,
    baseRate,
    boostRate,
    capMonthly: boost.capMonthly,
    capUsedBefore: o.capUsed,
    boostCashback,
    baseCashback,
    cashback,
    effectiveRate: o.amount > 0 ? (cashback / o.amount) * 100 : 0,
    capHit: rawBoost > capRemaining,
  };
}

/* ---------------- monthly cap counters ---------------- */

// Boost cashback accrued THIS month, per category. Seeded so the demo shows caps
// partially used (airlines near its cap). Real build: increment on each settled
// boosted txn; reset on month rollover.
let capUsed: Record<SpendCategory, number> = { ai: 22, airlines: 41, rides: 9 };
const listeners = new Set<() => void>();
const emit = () => {
  capUsed = { ...capUsed };
  listeners.forEach((l) => l());
};

export function useCapUsage(): Record<SpendCategory, number> {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => capUsed,
    () => capUsed,
  );
}

export function getCapUsed(category: SpendCategory): number {
  return capUsed[category];
}

/** Record a settled boosted txn against the monthly cap (real build calls this). */
export function accrueBoost(category: SpendCategory, boostCashback: number) {
  capUsed[category] += boostCashback;
  emit();
}

export function resetCaps() {
  capUsed = { ai: 0, airlines: 0, rides: 0 };
  emit();
}

/** How much boost budget is left this month, per category, for the given tier. */
export function capStatus(tierId: TierId) {
  const t = tierById(tierId);
  return CATEGORY_ORDER.map((c) => ({
    category: c,
    used: capUsed[c],
    cap: t.boosts[c].capMonthly,
    remaining: Math.max(0, t.boosts[c].capMonthly - capUsed[c]),
    pct: t.boosts[c].capMonthly > 0 ? Math.min(1, capUsed[c] / t.boosts[c].capMonthly) : 0,
  }));
}
