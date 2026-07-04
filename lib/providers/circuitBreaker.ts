import 'server-only';

import { getRedis } from '@/lib/redis/client';
import {
  decideBreakerState,
  PROVIDER_NAMES,
  stateAllows,
  type BreakerState,
  type ProviderBudget,
  type ProviderName,
} from '@/lib/providers/breakerDecisions';

/**
 * PROVIDER CIRCUIT BREAKERS (Phase 0.3) — cost protection for paid upstreams
 * (Helius, Moralis, InsightX, DexScreener, Jupiter).
 *
 *  - Atomic per-provider daily + monthly usage counters (INCRBYFLOAT).
 *  - Soft warning at `warnPct`, HARD CUTOFF when over budget (`tripped`).
 *  - Manual emergency cutoff per provider (admin toggle → `disabled`).
 *  - FAILS OPEN on a Redis error: a cost guard for the data path must not take
 *    Helius/Jupiter down on a transient Redis blip. (Contrast the AI spend guard
 *    in Phase 0.2, which is fail-CLOSED per spec.) Budgets are still enforced
 *    whenever Redis is reachable, which is the case during a real runaway.
 *
 * Budgets are env-configurable (defaults are generous so normal ops never trip —
 * tune to your plan). Wrap a provider call's chokepoint with `guardProvider`.
 */

const n = (v: string | undefined, d: number) => (v != null && Number.isFinite(Number(v)) ? Number(v) : d);

const BUDGETS: Record<ProviderName, ProviderBudget> = {
  helius: {
    daily: n(process.env.HELIUS_DAILY_CREDITS, 1_000_000),
    monthly: n(process.env.HELIUS_MONTHLY_CREDITS, 15_000_000),
    warnPct: 80,
  },
  moralis: {
    daily: n(process.env.MORALIS_DAILY_REQUESTS, 10_000),
    monthly: n(process.env.MORALIS_MONTHLY_REQUESTS, 100_000),
    warnPct: 80,
  },
  insightx: {
    daily: n(process.env.INSIGHTX_DAILY_BUDGET, 0), // 0 = no daily cap (free tier is monthly)
    monthly: n(process.env.INSIGHTX_MONTHLY_BUDGET, 950),
    warnPct: 80,
  },
  dexscreener: {
    daily: n(process.env.DEXSCREENER_DAILY_REQUESTS, 200_000),
    monthly: n(process.env.DEXSCREENER_MONTHLY_REQUESTS, 0),
    warnPct: 90,
  },
  jupiter: {
    daily: n(process.env.JUPITER_DAILY_REQUESTS, 200_000),
    monthly: n(process.env.JUPITER_MONTHLY_REQUESTS, 0),
    warnPct: 90,
  },
};

export function providerBudget(p: ProviderName): ProviderBudget {
  return BUDGETS[p];
}

function dayKey(): string {
  return new Date().toISOString().slice(0, 10);
}
function monthKey(): string {
  return new Date().toISOString().slice(0, 7);
}
const dailyKey = (p: ProviderName) => `prov:u:${p}:${dayKey()}`;
const monthlyKey = (p: ProviderName) => `prov:u:${p}:${monthKey()}`;
const cutoffKey = (p: ProviderName) => `prov:cutoff:${p}`;

export class ProviderBreakerError extends Error {
  constructor(
    public provider: ProviderName,
    public state: BreakerState,
  ) {
    super(`${provider} circuit breaker is ${state} — provider calls are paused`);
    this.name = 'ProviderBreakerError';
  }
}

export type BreakerDecision = {
  allowed: boolean;
  state: BreakerState;
  usedDaily: number;
  usedMonthly: number;
};

/**
 * Charge `units` against a provider and decide whether the call may proceed.
 * Atomic; FAILS OPEN on a Redis error (returns allowed).
 */
export async function chargeProvider(provider: ProviderName, units: number): Promise<BreakerDecision> {
  const budget = BUDGETS[provider];
  try {
    const redis = getRedis();
    const cut = await redis.get<string | number | null>(cutoffKey(provider));
    if (cut === '1' || cut === 1) {
      return { allowed: false, state: 'disabled', usedDaily: 0, usedMonthly: 0 };
    }
    const dK = dailyKey(provider);
    const mK = monthlyKey(provider);
    const usedDaily = await redis.incrbyfloat(dK, units);
    const usedMonthly = await redis.incrbyfloat(mK, units);
    await redis.expire(dK, 60 * 60 * 36);
    await redis.expire(mK, 60 * 60 * 24 * 35);
    const state = decideBreakerState(usedDaily, usedMonthly, budget);
    return { allowed: stateAllows(state), state, usedDaily, usedMonthly };
  } catch {
    return { allowed: true, state: 'ok', usedDaily: 0, usedMonthly: 0 }; // fail open
  }
}

/** Throw {@link ProviderBreakerError} when the provider is tripped/disabled. */
export async function guardProvider(provider: ProviderName, units: number): Promise<void> {
  const d = await chargeProvider(provider, units);
  if (!d.allowed) throw new ProviderBreakerError(provider, d.state);
}

/** Manual emergency cutoff (admin). Throws if Redis is unreachable. */
export async function setProviderCutoff(provider: ProviderName, disabled: boolean): Promise<void> {
  const redis = getRedis();
  if (disabled) await redis.set(cutoffKey(provider), '1');
  else await redis.del(cutoffKey(provider));
}

export type ProviderStatus = {
  provider: ProviderName;
  state: BreakerState;
  disabled: boolean;
  usedDaily: number;
  usedMonthly: number;
  budget: ProviderBudget;
};

/** Admin view: current usage + state for every provider (read-only, no charge). */
export async function getProviderStates(): Promise<ProviderStatus[]> {
  const out: ProviderStatus[] = [];
  let redis: ReturnType<typeof getRedis> | null = null;
  try {
    redis = getRedis();
  } catch {
    redis = null;
  }
  for (const provider of PROVIDER_NAMES) {
    const budget = BUDGETS[provider];
    let usedDaily = 0;
    let usedMonthly = 0;
    let disabled = false;
    if (redis) {
      try {
        const [d, m, cut] = await Promise.all([
          redis.get<string | number | null>(dailyKey(provider)),
          redis.get<string | number | null>(monthlyKey(provider)),
          redis.get<string | number | null>(cutoffKey(provider)),
        ]);
        usedDaily = Number(d ?? 0) || 0;
        usedMonthly = Number(m ?? 0) || 0;
        disabled = cut === '1' || cut === 1;
      } catch {
        /* leave zeros */
      }
    }
    const state: BreakerState = disabled ? 'disabled' : decideBreakerState(usedDaily, usedMonthly, budget);
    out.push({ provider, state, disabled, usedDaily, usedMonthly, budget });
  }
  return out;
}
