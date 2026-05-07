/**
 * Internal v1 points formula constants. Used only by {@link awardPoints} server-side — not exposed in UI or public APIs (Phase 4 Step 11).
 */

export const POINTS_FORMULA_V1 = {
  trade_volume: { points_per_sol: 10, max_per_day: 5000 },
  referral_volume: { points_per_sol: 5 },
  daily_login: { points: 50, streak_bonus_per_day: 10, streak_max: 30 },
  tracker_setup: { points: 100, max_per_user: 5 },
  first_trade: { points: 500 },
  feedback_submitted: { points: 200 },
  social_share: { points: 150, max_per_day: 1 },
} as const;

export type PointsFormulaEventType = keyof typeof POINTS_FORMULA_V1;

export const POINTS_FORMULA_VERSION = process.env.POINTS_FORMULA_VERSION ?? 'v1';
