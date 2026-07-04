import 'server-only';

import { NextResponse } from 'next/server';
import { getRedis, type RedisLike } from '@/lib/redis/client';
import {
  decideAi,
  decideCashback,
  decidePacks,
  decideReferral,
  decideTrading,
  decideWrite,
  defaultControls,
  EmergencyBlockedError,
  failClosedControls,
  normalizeControls,
  type EmergencyBanner,
  type EmergencyChain,
  type EmergencyControls,
} from '@/lib/emergency/decisions';

/**
 * EMERGENCY CONTROL SYSTEM (Phase 0.1) — I/O wrapper around the pure decision
 * logic in `./decisions`.
 *
 *  - Stored in Redis (`emergency:controls`, durable on Upstash) so changes go
 *    live within ~5s WITHOUT a redeploy.
 *  - Read through a short in-process cache (5s) so the hot path costs ~0 Redis.
 *  - FAILS CLOSED: if we cannot read the truth and have no cached value, every
 *    protected path is treated as paused (reads still work).
 *
 * Guards throw {@link EmergencyBlockedError}; routes turn it into a 503 via
 * {@link emergencyBlockedResponse}. Call the relevant `assert*` at the top of
 * every money/AI/webhook/cron entry point.
 */

// Re-export the pure API so callers import everything from one module.
export * from '@/lib/emergency/decisions';

const KEY = 'emergency:controls';
const CACHE_TTL_MS = 5_000;

let cache: { at: number; controls: EmergencyControls } | null = null;
let redisOverride: RedisLike | null = null;

function redis(): RedisLike {
  return redisOverride ?? getRedis();
}

/** Test seam: inject a redis (e.g. a throwing stub) and reset the cache. */
export function __setEmergencyRedisForTest(client: RedisLike | null): void {
  redisOverride = client;
  cache = null;
}
export function __resetEmergencyCacheForTest(): void {
  cache = null;
}

async function readUncached(): Promise<EmergencyControls> {
  return normalizeControls(await redis().get<Partial<EmergencyControls>>(KEY));
}

/** Live controls. 5s in-process cache; tolerates a transient Redis blip with the
 *  last-known value; FAILS CLOSED (everything paused) on a cold read error. */
export async function getControls(): Promise<EmergencyControls> {
  if (cache && Date.now() - cache.at < CACHE_TTL_MS) return cache.controls;
  try {
    const controls = await readUncached();
    cache = { at: Date.now(), controls };
    return controls;
  } catch {
    if (cache) return cache.controls;
    return failClosedControls();
  }
}

/** Apply a patch (merged) and persist. Throws if Redis is unreachable so the
 *  admin sees the change did NOT take effect. Returns the new full state. */
export async function setControls(
  patch: Partial<EmergencyControls>,
  updatedBy: string,
): Promise<EmergencyControls> {
  let current: EmergencyControls;
  try {
    current = await readUncached();
  } catch {
    current = defaultControls();
  }
  const next = normalizeControls({
    ...current,
    ...patch,
    chains: { ...current.chains, ...(patch.chains ?? {}) },
    updatedAt: new Date().toISOString(),
    updatedBy,
  });
  await redis().set(KEY, JSON.stringify(next)); // throws on Redis failure (intentional)
  cache = { at: Date.now(), controls: next };
  return next;
}

/* --------------------------------- guards -------------------------------- */

export async function assertTradingAllowed(chain?: EmergencyChain): Promise<void> {
  const e = decideTrading(await getControls(), chain);
  if (e) throw e;
}
export async function assertAiAllowed(): Promise<void> {
  const e = decideAi(await getControls());
  if (e) throw e;
}
export async function assertPacksAllowed(): Promise<void> {
  const e = decidePacks(await getControls());
  if (e) throw e;
}
export async function assertCashbackAllowed(): Promise<void> {
  const e = decideCashback(await getControls());
  if (e) throw e;
}
export async function assertReferralAllowed(): Promise<void> {
  const e = decideReferral(await getControls());
  if (e) throw e;
}
export async function assertWriteAllowed(): Promise<void> {
  const e = decideWrite(await getControls());
  if (e) throw e;
}

/** Boolean checks for SIDE-EFFECT paths (cashback/referral accrual) that must
 *  SKIP rather than fail the parent trade when paused. Fail closed → false. */
export async function isCashbackEnabled(): Promise<boolean> {
  return decideCashback(await getControls()) === null;
}
export async function isReferralEnabled(): Promise<boolean> {
  return decideReferral(await getControls()) === null;
}
/** True when the app should refuse mutations (maintenance or read-only). */
export async function isReadOnly(): Promise<boolean> {
  return decideWrite(await getControls()) !== null;
}

/* --------------------------------- http ---------------------------------- */

/** 503 for a blocked request. Safe to surface to clients (no internals). */
export function emergencyBlockedResponse(err: EmergencyBlockedError): NextResponse {
  return NextResponse.json(
    { error: 'service_unavailable', code: err.code, message: err.message },
    { status: 503, headers: { 'Retry-After': '60' } },
  );
}

/** Public, non-sensitive view for the banner / maintenance UI. */
export async function publicStatus(): Promise<{
  maintenance: boolean;
  readOnly: boolean;
  banner: EmergencyBanner | null;
}> {
  const c = await getControls();
  return { maintenance: c.maintenance, readOnly: c.readOnly, banner: c.banner };
}
