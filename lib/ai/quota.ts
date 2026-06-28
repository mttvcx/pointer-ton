import 'server-only';

import { getAIQuotaForUser } from '@/lib/db/tiers';
import { getRedis } from '@/lib/redis/client';
import {
  AI_RATE_LIMIT_MAX_CALLS,
  AI_RATE_LIMIT_WINDOW_SECONDS,
  DEFAULT_AI_DAILY_QUOTA_USD,
} from '@/lib/utils/constants';

export class QuotaError extends Error {
  status: number;
  code: 'rate_limited' | 'cost_ceiling' | 'unauthenticated';
  retryAfterSeconds?: number;
  constructor(
    code: 'rate_limited' | 'cost_ceiling' | 'unauthenticated',
    message: string,
    init: { status?: number; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = 'QuotaError';
    this.code = code;
    this.status = init.status ?? (code === 'unauthenticated' ? 401 : 429);
    this.retryAfterSeconds = init.retryAfterSeconds;
  }
}

const RL_PREFIX = 'ai:rl:';
const COST_PREFIX = 'ai:cost:';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

function rateKey(userId: string): string {
  return `${RL_PREFIX}${userId}`;
}

function costKey(userId: string): string {
  return `${COST_PREFIX}${userId}:${todayKey()}`;
}

/**
 * Sliding-window count of recent calls (sorted set scored by timestamp).
 * Throws `QuotaError` when the user is over the cap.
 */
export async function enforceRateLimit(userId: string): Promise<void> {
  const redis = getRedis();
  const key = rateKey(userId);
  const now = Date.now();
  const windowMs = AI_RATE_LIMIT_WINDOW_SECONDS * 1000;
  const cutoff = now - windowMs;

  try {
    await redis.zremrangebyscore(key, 0, cutoff);
    const count = await redis.zcard(key);
    if (count >= AI_RATE_LIMIT_MAX_CALLS) {
      throw new QuotaError(
        'rate_limited',
        `AI rate limit: ${AI_RATE_LIMIT_MAX_CALLS} calls per ${AI_RATE_LIMIT_WINDOW_SECONDS}s`,
        { retryAfterSeconds: AI_RATE_LIMIT_WINDOW_SECONDS },
      );
    }
    await redis.zadd(key, { score: now, member: `${now}-${Math.random()}` });
    await redis.expire(key, AI_RATE_LIMIT_WINDOW_SECONDS * 2);
  } catch (err) {
    if (err instanceof QuotaError) throw err;
    console.warn('[ai-quota] rate-limit check failed', err);
  }
}

/**
 * Read-only snapshot of the user's sliding-window rate-limit state. Prunes
 * expired entries but, unlike {@link enforceRateLimit}, records no new call —
 * safe to call from a status endpoint. Best-effort: returns a full-budget
 * snapshot if Redis is unavailable.
 */
export async function getRateLimitState(
  userId: string,
): Promise<{ used: number; max: number; windowSeconds: number; remaining: number }> {
  const max = AI_RATE_LIMIT_MAX_CALLS;
  const windowSeconds = AI_RATE_LIMIT_WINDOW_SECONDS;
  try {
    const redis = getRedis();
    const key = rateKey(userId);
    await redis.zremrangebyscore(key, 0, Date.now() - windowSeconds * 1000);
    const used = await redis.zcard(key);
    return { used, max, windowSeconds, remaining: Math.max(0, max - used) };
  } catch {
    return { used: 0, max, windowSeconds, remaining: max };
  }
}

/**
 * Check that the user is below their daily cost ceiling. Reads (does not
 * increment) so the cascade can avoid charging for cache hits.
 */
export async function ensureUnderCostCeiling(userId: string): Promise<{ used: number; cap: number }> {
  const cap = await getCapForUser(userId);
  const used = await getCostUsedToday(userId);
  if (used >= cap) {
    throw new QuotaError(
      'cost_ceiling',
      `Daily AI quota exhausted (${used.toFixed(4)}/${cap.toFixed(2)} USD)`,
    );
  }
  return { used, cap };
}

export async function getCapForUser(userId: string): Promise<number> {
  try {
    return await getAIQuotaForUser(userId);
  } catch {
    return DEFAULT_AI_DAILY_QUOTA_USD;
  }
}

export async function getCostUsedToday(userId: string): Promise<number> {
  try {
    const v = await getRedis().get<string | number | null>(costKey(userId));
    return typeof v === 'number' ? v : Number(v ?? 0) || 0;
  } catch {
    return 0;
  }
}

/**
 * Add `costUsd` to the user's daily counter (best-effort; never throws).
 * Sets a 36h expiry so the day rolls cleanly even if calls drift past midnight.
 */
export async function recordCost(userId: string, costUsd: number): Promise<void> {
  if (!Number.isFinite(costUsd) || costUsd <= 0) return;
  try {
    const redis = getRedis();
    const k = costKey(userId);
    await redis.incrbyfloat(k, costUsd);
    await redis.expire(k, 60 * 60 * 36);
  } catch (err) {
    console.warn('[ai-quota] recordCost failed', err);
  }
}
