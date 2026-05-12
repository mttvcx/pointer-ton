import 'server-only';

import { getRedis } from '@/lib/redis/client';
import {
  DEFAULT_POINTER_IDENTITY,
  PointerIdentitySchema,
  type PointerIdentity,
} from '@/lib/squads/types';

/**
 * Phase 1 storage for Pointer identity links.
 *
 * Why Redis (not Postgres) right now:
 *  - The Phase 2 migration (`scripts/migrations/0010-squads.sql`) defines the
 *    canonical `pointer_identities` table, but we don't want to gate the
 *    Phase 1 launch on DDL being applied. Redis lets the trader profile
 *    drawer + identity linking ship today.
 *  - Migration to Postgres is a one-shot script: read every key, upsert into
 *    the `pointer_identities` table, delete Redis keys. Tracked as TODO.
 *
 * Key shape:
 *   pointer:identity:v1:{userId} → JSON.stringify(PointerIdentity)
 * TTL:
 *   none — these are user-edited records, not caches.
 *
 * Failure mode:
 *  - get → returns DEFAULT_POINTER_IDENTITY on any error (never throws).
 *  - put → throws on write failure so the API route can 5xx; we never want
 *          to silently lose an identity write.
 */

const VERSION = 'v1';
const KEY_PREFIX = 'pointer:identity';

function key(userId: string): string {
  return `${KEY_PREFIX}:${VERSION}:${userId}`;
}

export async function getPointerIdentity(userId: string): Promise<PointerIdentity> {
  try {
    const redis = getRedis();
    const raw = await redis.get<string | PointerIdentity>(key(userId));
    if (!raw) return { ...DEFAULT_POINTER_IDENTITY };

    const parsed =
      typeof raw === 'string'
        ? PointerIdentitySchema.safeParse(JSON.parse(raw))
        : PointerIdentitySchema.safeParse(raw);

    if (!parsed.success) return { ...DEFAULT_POINTER_IDENTITY };
    return parsed.data;
  } catch {
    return { ...DEFAULT_POINTER_IDENTITY };
  }
}

export async function putPointerIdentity(
  userId: string,
  patch: PointerIdentity,
): Promise<PointerIdentity> {
  const merged: PointerIdentity = {
    ...DEFAULT_POINTER_IDENTITY,
    ...patch,
    privacy: {
      ...DEFAULT_POINTER_IDENTITY.privacy,
      ...(patch.privacy ?? {}),
    },
    updatedAt: Date.now(),
  };
  const validated = PointerIdentitySchema.parse(merged);
  const redis = getRedis();
  await redis.set(key(userId), JSON.stringify(validated));
  return validated;
}
