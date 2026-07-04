import 'server-only';

import { getRedis } from '@/lib/redis/client';

/**
 * Durable webhook idempotency claim. The previous Helius dedup used a 60s TTL,
 * which is too short for an upstream that can re-deliver minutes apart. We claim
 * the signature for 24h by default (SET NX EX). Downstream writes are also
 * idempotent (mint upsert, swap composite-key dedup), so this is defense in
 * depth, not the only guard. Fails OPEN on a Redis error (returns claimed) — a
 * duplicate is cheaper than dropping a real event, and downstream dedup catches
 * the rare double.
 */
const DEFAULT_TTL_SEC = 24 * 60 * 60;

const claimKey = (provider: string, signature: string) => `wh:dedup:${provider}:${signature}`;

/** Returns true if THIS caller won the claim (first time seen); false if dup. */
export async function claimWebhook(
  provider: string,
  signature: string,
  ttlSec: number = DEFAULT_TTL_SEC,
): Promise<boolean> {
  try {
    const res = await getRedis().set(claimKey(provider, signature), '1', { ex: ttlSec, nx: true });
    return res != null;
  } catch {
    return true; // fail open
  }
}

/** Release a claim (e.g. processing failed terminally and we want a clean retry). */
export async function releaseWebhookClaim(provider: string, signature: string): Promise<void> {
  try {
    await getRedis().del(claimKey(provider, signature));
  } catch {
    /* best effort */
  }
}
