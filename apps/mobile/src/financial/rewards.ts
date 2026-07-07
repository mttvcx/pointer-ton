/**
 * Compounding cashback — the ether.fi move: cashback isn't a dead points balance,
 * it's paid into your yield so it keeps earning. We pay in USDC swept straight
 * into Smart Yield (not a throwaway token), so "your rewards never stop working".
 *
 * DEMO: derived from a notional monthly card spend × your tier rate, so a higher
 * membership visibly earns more. REAL build: sum settled card spend × rate and
 * credit the yield vault on settlement.
 */

export type RewardsModel = {
  rate: number; // % cashback (from the user's tier, credit-mode)
  thisMonthUsd: number; // cashback earned so far this month
  allTimeUsd: number; // lifetime cashback, still compounding in yield
  projectedYearUsd: number; // at current spend + rate
  yieldOnRewardsUsd: number; // extra earned because cashback sits in yield
};

// Notional demo spend so the numbers feel lived-in (real build uses settled spend).
const MONTHLY_SPEND = 2_140;
const MONTHS_ACTIVE = 11;

/** Cashback picture for a given tier credit-mode rate + the yield APY it compounds at. */
export function demoRewards(ratePct: number, yieldApy: number): RewardsModel {
  const thisMonthUsd = (MONTHLY_SPEND * ratePct) / 100;
  const allTimeUsd = thisMonthUsd * MONTHS_ACTIVE + thisMonthUsd * 0.6;
  const projectedYearUsd = thisMonthUsd * 12;
  // The compounding kicker: lifetime cashback sitting in yield for ~half its life.
  const yieldOnRewardsUsd = (allTimeUsd * (yieldApy / 100)) / 2;
  return {
    rate: ratePct,
    thisMonthUsd,
    allTimeUsd,
    projectedYearUsd,
    yieldOnRewardsUsd,
  };
}
