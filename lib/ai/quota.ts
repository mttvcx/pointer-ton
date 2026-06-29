import 'server-only';

import { createHash } from 'node:crypto';
import { headers } from 'next/headers';
import { getAIQuotaForUser } from '@/lib/db/tiers';
import { getRedis } from '@/lib/redis/client';
import {
  fixedWindowBucket,
  isOverFixedWindow,
  pickCeilingBreach,
  type CeilingBreach,
  type SpendCounters,
} from '@/lib/ai/quotaDecisions';
import {
  AI_GLOBAL_DAILY_USD,
  AI_GLOBAL_HOURLY_USD,
  AI_GLOBAL_MONTHLY_USD,
  AI_IP_RATE_LIMIT_MAX_CALLS,
  AI_IP_RATE_LIMIT_WINDOW_SECONDS,
  AI_RATE_LIMIT_MAX_CALLS,
  AI_RATE_LIMIT_WINDOW_SECONDS,
  AI_SPEND_RESERVE_USD,
  DEFAULT_AI_DAILY_QUOTA_USD,
} from '@/lib/utils/constants';

/**
 * AI QUOTA + SPEND GUARD (Phase 0.2) — atomic and FAIL CLOSED.
 *
 * The old implementation read-then-wrote (a check-then-act race) and swallowed
 * Redis errors (fail OPEN), so concurrency or a Redis blip bypassed every limit.
 * This version:
 *   - Rate limits with an atomic fixed-window `INCR` (per user AND per IP).
 *   - Reserves a conservative cost estimate atomically BEFORE the model call,
 *     across per-user-daily + org hourly/daily/monthly ceilings, then settles to
 *     the real cost after (or refunds on failure).
 *   - On ANY Redis error, THROWS (denies the call). Redis failure must never
 *     allow unlimited spending.
 */

export class QuotaError extends Error {
  status: number;
  code: 'rate_limited' | 'cost_ceiling' | 'unauthenticated' | 'guard_unavailable';
  retryAfterSeconds?: number;
  constructor(
    code: 'rate_limited' | 'cost_ceiling' | 'unauthenticated' | 'guard_unavailable',
    message: string,
    init: { status?: number; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = 'QuotaError';
    this.code = code;
    this.status = init.status ?? (code === 'unauthenticated' ? 401 : code === 'guard_unavailable' ? 503 : 429);
    this.retryAfterSeconds = init.retryAfterSeconds;
  }
}

/* -------------------------------- time keys ------------------------------- */

function dayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}
function hourKey(): string {
  return new Date().toISOString().slice(0, 13); // YYYY-MM-DDTHH
}
function monthKey(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

const userDailyKey = (u: string) => `ai:cost:u:${u}:${dayKey()}`;
const globalDailyKey = () => `ai:cost:g:${dayKey()}`;
const globalHourlyKey = () => `ai:cost:gh:${hourKey()}`;
const globalMonthlyKey = () => `ai:cost:gm:${monthKey()}`;

/* ------------------------------- rate limit ------------------------------- */

/** Atomic fixed-window counter. FAILS CLOSED on any Redis error. */
async function bumpFixedWindow(prefix: string, windowSeconds: number, max: number): Promise<void> {
  const key = `${prefix}:${fixedWindowBucket(Date.now(), windowSeconds)}`;
  let n: number;
  try {
    const redis = getRedis();
    n = await redis.incr(key);
    if (n === 1) await redis.expire(key, windowSeconds + 1);
  } catch {
    throw new QuotaError('guard_unavailable', 'Rate limiter unavailable — try again shortly.', {
      retryAfterSeconds: windowSeconds,
    });
  }
  if (isOverFixedWindow(n, max)) {
    throw new QuotaError('rate_limited', `AI rate limit: ${max} calls per ${windowSeconds}s`, {
      retryAfterSeconds: windowSeconds,
    });
  }
}

/** Hash of the caller IP for the per-IP key (privacy), or null outside a request. */
async function requestIpHash(): Promise<string | null> {
  try {
    const h = await headers();
    const raw = (h.get('x-forwarded-for') || h.get('x-real-ip') || '').split(',')[0]?.trim();
    if (!raw) return null;
    return createHash('sha256').update(raw).digest('hex').slice(0, 16);
  } catch {
    return null; // not in a request scope (cron / background) — skip per-IP limit
  }
}

/** Per-user AND per-IP atomic fixed-window rate limit. Fails closed. */
export async function enforceRateLimit(userId: string): Promise<void> {
  await bumpFixedWindow(`ai:rl:u:${userId}`, AI_RATE_LIMIT_WINDOW_SECONDS, AI_RATE_LIMIT_MAX_CALLS);
  const ip = await requestIpHash();
  if (ip) await bumpFixedWindow(`ai:rl:ip:${ip}`, AI_IP_RATE_LIMIT_WINDOW_SECONDS, AI_IP_RATE_LIMIT_MAX_CALLS);
}

/* ------------------------------ spend ceiling ----------------------------- */

export type SpendReservation = { userId: string; pipeline: string; estimate: number };

async function adjustSpend(userId: string, delta: number): Promise<void> {
  const redis = getRedis();
  await redis.incrbyfloat(userDailyKey(userId), delta);
  await redis.incrbyfloat(globalDailyKey(), delta);
  await redis.incrbyfloat(globalHourlyKey(), delta);
  await redis.incrbyfloat(globalMonthlyKey(), delta);
}

/**
 * Reserve the conservative estimate across every ceiling atomically, then check.
 * Returns a reservation to settle/release. FAILS CLOSED — a Redis error denies
 * the call rather than allowing unmetered spend.
 */
export async function reserveAiSpend(userId: string, pipeline: string): Promise<SpendReservation> {
  const estimate = AI_SPEND_RESERVE_USD;
  const userCap = await getCapForUser(userId);

  let counters: SpendCounters;
  try {
    const redis = getRedis();
    const uK = userDailyKey(userId);
    const gdK = globalDailyKey();
    const ghK = globalHourlyKey();
    const gmK = globalMonthlyKey();
    const userDaily = await redis.incrbyfloat(uK, estimate);
    const globalDaily = await redis.incrbyfloat(gdK, estimate);
    const globalHourly = await redis.incrbyfloat(ghK, estimate);
    const globalMonthly = await redis.incrbyfloat(gmK, estimate);
    await redis.expire(uK, 60 * 60 * 36);
    await redis.expire(gdK, 60 * 60 * 36);
    await redis.expire(ghK, 60 * 60 * 3);
    await redis.expire(gmK, 60 * 60 * 24 * 35);
    counters = { userDaily, globalDaily, globalHourly, globalMonthly };
  } catch {
    throw new QuotaError('guard_unavailable', 'AI spend guard unavailable — try again shortly.');
  }

  const breach: CeilingBreach = pickCeilingBreach(counters, {
    userDaily: userCap,
    globalHourly: AI_GLOBAL_HOURLY_USD,
    globalDaily: AI_GLOBAL_DAILY_USD,
    globalMonthly: AI_GLOBAL_MONTHLY_USD,
  });
  if (breach) {
    await adjustSpend(userId, -estimate).catch(() => {}); // refund (safe direction: over-count if it fails)
    const human =
      breach === 'user_daily'
        ? `Daily AI quota exhausted (cap $${userCap.toFixed(2)})`
        : `AI spend ceiling reached (${breach})`;
    throw new QuotaError('cost_ceiling', human);
  }
  return { userId, pipeline, estimate };
}

/** Adjust the reservation to the real cost + record per-user/endpoint/provider
 *  spend for the dashboard. Best-effort — the protective reservation already
 *  counted, so a settle failure only loses accounting precision (safe). */
export async function settleAiSpend(
  res: SpendReservation,
  actualUsd: number,
  modelKey: string,
): Promise<void> {
  const spend = Number.isFinite(actualUsd) && actualUsd > 0 ? actualUsd : 0;
  const delta = spend - res.estimate;
  try {
    if (delta !== 0) await adjustSpend(res.userId, delta);
    if (spend > 0) {
      const redis = getRedis();
      const day = dayKey();
      await redis.zincrby(`ai:spend:users:${day}`, spend, res.userId);
      await redis.zincrby(`ai:spend:endpoints:${day}`, spend, res.pipeline);
      await redis.zincrby(`ai:spend:providers:${day}`, spend, modelKey);
      await redis.expire(`ai:spend:users:${day}`, 60 * 60 * 36);
      await redis.expire(`ai:spend:endpoints:${day}`, 60 * 60 * 36);
      await redis.expire(`ai:spend:providers:${day}`, 60 * 60 * 36);
    }
  } catch (err) {
    console.warn('[ai-quota] settle failed', err);
  }
}

/** Refund the reservation when the model call produced no billable result. */
export async function releaseAiSpend(res: SpendReservation): Promise<void> {
  await adjustSpend(res.userId, -res.estimate).catch(() => {});
}

/* ------------------------------- read helpers ----------------------------- */

export async function getCapForUser(userId: string): Promise<number> {
  try {
    return await getAIQuotaForUser(userId);
  } catch {
    return DEFAULT_AI_DAILY_QUOTA_USD;
  }
}

export async function getCostUsedToday(userId: string): Promise<number> {
  try {
    const v = await getRedis().get<string | number | null>(userDailyKey(userId));
    return typeof v === 'number' ? v : Number(v ?? 0) || 0;
  } catch {
    return 0;
  }
}

/** Read-only fixed-window snapshot for the user's quota status endpoint. */
export async function getRateLimitState(
  userId: string,
): Promise<{ used: number; max: number; windowSeconds: number; remaining: number }> {
  const max = AI_RATE_LIMIT_MAX_CALLS;
  const windowSeconds = AI_RATE_LIMIT_WINDOW_SECONDS;
  try {
    const key = `ai:rl:u:${userId}:${fixedWindowBucket(Date.now(), windowSeconds)}`;
    const v = await getRedis().get<string | number | null>(key);
    const used = typeof v === 'number' ? v : Number(v ?? 0) || 0;
    return { used, max, windowSeconds, remaining: Math.max(0, max - used) };
  } catch {
    return { used: 0, max, windowSeconds, remaining: max };
  }
}

/* ------------------------------ admin summary ----------------------------- */

function num(v: unknown): number {
  return typeof v === 'number' ? v : Number(v ?? 0) || 0;
}
function parseLeaderboard(flat: string[]): { member: string; usd: number }[] {
  const out: { member: string; usd: number }[] = [];
  for (let i = 0; i + 1 < flat.length; i += 2) out.push({ member: flat[i]!, usd: Number(flat[i + 1]) || 0 });
  return out;
}

export type AiSpendSummary = {
  hourly: number;
  daily: number;
  monthly: number;
  caps: { hourly: number; daily: number; monthly: number };
  topUsers: { member: string; usd: number }[];
  topEndpoints: { member: string; usd: number }[];
  providers: { member: string; usd: number }[];
  error?: boolean;
};

/** Spend dashboard data: org hourly/daily/monthly totals vs caps + leaderboards. */
export async function getSpendSummary(): Promise<AiSpendSummary> {
  const caps = { hourly: AI_GLOBAL_HOURLY_USD, daily: AI_GLOBAL_DAILY_USD, monthly: AI_GLOBAL_MONTHLY_USD };
  try {
    const redis = getRedis();
    const day = dayKey();
    const [hourly, daily, monthly, topUsers, topEndpoints, providers] = await Promise.all([
      redis.get(globalHourlyKey()),
      redis.get(globalDailyKey()),
      redis.get(globalMonthlyKey()),
      redis.zrange(`ai:spend:users:${day}`, 0, 9, { rev: true, withScores: true }),
      redis.zrange(`ai:spend:endpoints:${day}`, 0, 9, { rev: true, withScores: true }),
      redis.zrange(`ai:spend:providers:${day}`, 0, 19, { rev: true, withScores: true }),
    ]);
    return {
      hourly: num(hourly),
      daily: num(daily),
      monthly: num(monthly),
      caps,
      topUsers: parseLeaderboard(topUsers),
      topEndpoints: parseLeaderboard(topEndpoints),
      providers: parseLeaderboard(providers),
    };
  } catch {
    return { hourly: 0, daily: 0, monthly: 0, caps, topUsers: [], topEndpoints: [], providers: [], error: true };
  }
}
