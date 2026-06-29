/**
 * AI quota — pure decision logic (no server-only / Redis / headers imports) so it
 * is unit-testable in isolation. The atomic I/O wrapper lives in `quota.ts`.
 */

export type SpendCounters = {
  userDaily: number;
  globalHourly: number;
  globalDaily: number;
  globalMonthly: number;
};
export type SpendCaps = {
  userDaily: number;
  globalHourly: number;
  globalDaily: number;
  globalMonthly: number;
};
export type CeilingBreach = 'global_hourly' | 'global_daily' | 'global_monthly' | 'user_daily' | null;

/**
 * Which ceiling (if any) is breached by the post-reservation counter values.
 * Global ceilings are checked before the per-user one so the org-wide cutoff
 * takes precedence in the rejection message. `null` = under all ceilings.
 */
export function pickCeilingBreach(v: SpendCounters, caps: SpendCaps): CeilingBreach {
  if (v.globalHourly > caps.globalHourly) return 'global_hourly';
  if (v.globalDaily > caps.globalDaily) return 'global_daily';
  if (v.globalMonthly > caps.globalMonthly) return 'global_monthly';
  if (v.userDaily > caps.userDaily) return 'user_daily';
  return null;
}

/**
 * Fixed-window rate-limit decision. Because the count comes from an atomic INCR,
 * each concurrent request gets a distinct value — so a simple `> max` is race
 * free (no check-then-act window).
 */
export function isOverFixedWindow(countAfterIncr: number, max: number): boolean {
  return countAfterIncr > max;
}

/** Fixed-window bucket id for a timestamp. */
export function fixedWindowBucket(nowMs: number, windowSeconds: number): number {
  return Math.floor(nowMs / (windowSeconds * 1000));
}
