/**
 * Provider circuit breaker — pure decision logic (no server-only / Redis) so it
 * is unit-testable. The atomic I/O wrapper lives in `circuitBreaker.ts`.
 */

export type ProviderName = 'helius' | 'moralis' | 'insightx' | 'dexscreener' | 'jupiter';
export const PROVIDER_NAMES: readonly ProviderName[] = [
  'helius',
  'moralis',
  'insightx',
  'dexscreener',
  'jupiter',
];

export type ProviderBudget = { daily: number; monthly: number; warnPct: number };
export type BreakerState = 'ok' | 'warn' | 'tripped' | 'disabled';

/**
 * Decide the breaker state from usage + budget. `tripped` (hard cutoff) when
 * either window is over budget; `warn` (soft) at >= warnPct of either window.
 * A budget of 0 means "unlimited" for that window. Manual `disabled` is handled
 * by the caller (separate flag), not here.
 */
export function decideBreakerState(
  usedDaily: number,
  usedMonthly: number,
  budget: ProviderBudget,
): BreakerState {
  const overDaily = budget.daily > 0 && usedDaily > budget.daily;
  const overMonthly = budget.monthly > 0 && usedMonthly > budget.monthly;
  if (overDaily || overMonthly) return 'tripped';
  const dailyPct = budget.daily > 0 ? (usedDaily / budget.daily) * 100 : 0;
  const monthlyPct = budget.monthly > 0 ? (usedMonthly / budget.monthly) * 100 : 0;
  if (dailyPct >= budget.warnPct || monthlyPct >= budget.warnPct) return 'warn';
  return 'ok';
}

/** Whether a state permits the provider call. */
export function stateAllows(state: BreakerState): boolean {
  return state === 'ok' || state === 'warn';
}
