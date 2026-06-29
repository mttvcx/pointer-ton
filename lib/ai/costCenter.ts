/**
 * AI cost-center math — pure (no I/O, unit-testable). Builds on the §0.2 spend
 * counters (per user/endpoint/model) with cache efficiency + projections for the
 * /admin/ai-spend dashboard.
 */

/** Cache hit rate, 0–100 (one decimal). 0 when nothing happened. */
export function cacheHitRate(hits: number, misses: number): number {
  const total = hits + misses;
  if (total <= 0) return 0;
  return Math.round((hits / total) * 1000) / 10;
}

/** Project this month's spend to a full-month estimate from elapsed days. */
export function projectMonthlySpend(spentThisMonth: number, dayOfMonth: number, daysInMonth: number): number {
  if (!(dayOfMonth > 0) || !(daysInMonth > 0)) return Math.max(0, spentThisMonth);
  const perDay = spentThisMonth / dayOfMonth;
  return Math.round(perDay * daysInMonth * 100) / 100;
}

/** Spend ÷ distinct users (4dp). 0 when no users. */
export function costPerUser(spend: number, distinctUsers: number): number {
  if (distinctUsers <= 0) return 0;
  return Math.round((spend / distinctUsers) * 10000) / 10000;
}

/** Dollars saved by the cache = hits × the average cost of a real (missed) call. */
export function savedByCache(hits: number, avgCostPerMiss: number): number {
  if (!(hits > 0) || !(avgCostPerMiss > 0)) return 0;
  return Math.round(hits * avgCostPerMiss * 100) / 100;
}

/** Days in the given month (1-based month). */
export function daysInMonth(year: number, month1: number): number {
  return new Date(year, month1, 0).getDate();
}
