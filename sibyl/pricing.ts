import type { PlanTier, ScanMode } from '@/sibyl/types';

/**
 * Business layer. Sibyl is architected to be a high-margin SaaS from day one:
 * 80–95% of calls run on cheap models; only DEEP_SCAN / RESEARCH_REPORT escalate.
 * Plans gate the max mode + daily volume so every tier is profitable.
 */

/** User-facing name for the daily allowance — we sell "token usage", not raw counts. */
export type TokenUsageTier = 'Starter' | 'Default' | 'Generous' | 'Max' | 'Custom';

export type PlanConfig = {
  tier: PlanTier;
  label: string;
  priceUsdMonthly: number | null; // null = contact sales
  /** Highest mode this plan may run (modes above are upsell-gated). */
  maxMode: ScanMode;
  /** Marketed allowance tier — Default / Generous / Max token usage. */
  tokenUsage: TokenUsageTier;
  /** Underlying daily scan quota (the number we actually meter; 0 = unlimited/contract). */
  dailyMessages: number;
  deepScansPerDay: number;
  apiCredits: number;
  /** Public /v1 API — a Max & Enterprise feature. */
  apiAccess: boolean;
};

const ORDER: ScanMode[] = ['HOVER_FAST', 'QUICK_SCAN', 'STANDARD_SCAN', 'DEEP_SCAN', 'RESEARCH_REPORT'];

export const PLANS: Record<PlanTier, PlanConfig> = {
  FREE: { tier: 'FREE', label: 'Free', priceUsdMonthly: 0, maxMode: 'QUICK_SCAN', tokenUsage: 'Starter', dailyMessages: 20, deepScansPerDay: 0, apiCredits: 0, apiAccess: false },
  PRO: { tier: 'PRO', label: 'Pro', priceUsdMonthly: 20, maxMode: 'STANDARD_SCAN', tokenUsage: 'Default', dailyMessages: 300, deepScansPerDay: 5, apiCredits: 0, apiAccess: false },
  PRO_PLUS: { tier: 'PRO_PLUS', label: 'Pro+', priceUsdMonthly: 49, maxMode: 'DEEP_SCAN', tokenUsage: 'Generous', dailyMessages: 1500, deepScansPerDay: 40, apiCredits: 0, apiAccess: false },
  MAX: { tier: 'MAX', label: 'Max', priceUsdMonthly: 199, maxMode: 'RESEARCH_REPORT', tokenUsage: 'Max', dailyMessages: 6000, deepScansPerDay: 200, apiCredits: 5000, apiAccess: true },
  ENTERPRISE: { tier: 'ENTERPRISE', label: 'Enterprise', priceUsdMonthly: null, maxMode: 'RESEARCH_REPORT', tokenUsage: 'Custom', dailyMessages: 0, deepScansPerDay: 0, apiCredits: 0, apiAccess: true },
};

/** Clamp a requested mode down to what the plan allows (the margin rule in code). */
export function clampModeToPlan(requested: ScanMode, tier: PlanTier): ScanMode {
  const cap = PLANS[tier].maxMode;
  const reqIdx = ORDER.indexOf(requested);
  const capIdx = ORDER.indexOf(cap);
  return reqIdx <= capIdx ? requested : cap;
}

/** Coarse cost estimate (USD) per mode — for unit-economics dashboards + throttling. */
export const MODE_COST_USD: Record<ScanMode, number> = {
  HOVER_FAST: 0.0003,
  QUICK_SCAN: 0.002,
  STANDARD_SCAN: 0.012,
  DEEP_SCAN: 0.08,
  RESEARCH_REPORT: 0.35,
};
