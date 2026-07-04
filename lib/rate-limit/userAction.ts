import 'server-only';

import { NextResponse } from 'next/server';
import { getRedis } from '@/lib/redis/client';

/**
 * Per-user rate limiting for authenticated routes. The public limiter
 * (`publicEdge.ts`) is IP-based and only covers cheap public reads; this is the
 * authed-user layer for sensitive actions (trade submissions, admin mutations).
 *
 * Sliding window over a Redis sorted set. Fail-open on ANY Redis error —
 * availability beats strictness, especially on money paths — and tunable /
 * disableable via env so it can be dialed without a deploy.
 */
export async function checkUserActionRateLimit(
  userId: string,
  action: string,
  maxInWindow: number,
  windowSeconds: number,
): Promise<{ ok: boolean; retryAfterSeconds: number }> {
  if (!userId || maxInWindow <= 0) return { ok: true, retryAfterSeconds: 0 };
  const key = `rl:user:${action}:${userId}`;
  const now = Date.now();
  try {
    const redis = getRedis();
    await redis.zremrangebyscore(key, 0, now - windowSeconds * 1000);
    const count = await redis.zcard(key);
    if (count >= maxInWindow) return { ok: false, retryAfterSeconds: windowSeconds };
    await redis.zadd(key, { score: now, member: `${now}-${Math.random()}` });
    await redis.expire(key, windowSeconds * 2);
    return { ok: true, retryAfterSeconds: 0 };
  } catch {
    return { ok: true, retryAfterSeconds: 0 }; // fail-open
  }
}

function tooManyResponse(retryAfterSeconds: number): NextResponse {
  return NextResponse.json(
    { error: 'rate_limited', message: 'Too many requests. Try again shortly.' },
    {
      status: 429,
      headers: { 'Retry-After': String(Math.max(1, retryAfterSeconds)), 'Cache-Control': 'no-store' },
    },
  );
}

function intEnv(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : fallback;
}

/**
 * Generous per-user cap on trade/broadcast submissions — stops a script from
 * hammering the money path; no human trades this fast. Default 60/min,
 * env-tunable (`TRADE_RATE_LIMIT_PER_MIN`), disable with
 * `POINTER_DISABLE_TRADE_RATE_LIMIT=1`. Fail-open. Returns a 429 or null.
 */
export async function enforceTradeRateLimit(userId: string): Promise<NextResponse | null> {
  if (process.env.POINTER_DISABLE_TRADE_RATE_LIMIT === '1') return null;
  const max = intEnv('TRADE_RATE_LIMIT_PER_MIN', 60);
  const { ok, retryAfterSeconds } = await checkUserActionRateLimit(userId, 'trade', max, 60);
  return ok ? null : tooManyResponse(retryAfterSeconds);
}

/**
 * Defense-in-depth cap on admin MUTATIONS (admins are already RBAC-gated). Reads
 * (GET/HEAD/OPTIONS) are never limited so dashboard polling is unaffected.
 * Default 120/min, env-tunable (`ADMIN_RATE_LIMIT_PER_MIN`), disable with
 * `POINTER_DISABLE_ADMIN_RATE_LIMIT=1`. Fail-open.
 */
export async function enforceAdminRateLimit(
  adminUserId: string,
  method: string,
): Promise<NextResponse | null> {
  if (process.env.POINTER_DISABLE_ADMIN_RATE_LIMIT === '1') return null;
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') return null;
  const max = intEnv('ADMIN_RATE_LIMIT_PER_MIN', 120);
  const { ok, retryAfterSeconds } = await checkUserActionRateLimit(adminUserId, 'admin', max, 60);
  return ok ? null : tooManyResponse(retryAfterSeconds);
}
