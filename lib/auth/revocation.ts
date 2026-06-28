import 'server-only';

import { getRedis } from '@/lib/redis/client';

/**
 * Session revocation ("log out everywhere"). A stateless JWT can't be un-issued,
 * so logout records a per-subject cutoff timestamp and any token issued BEFORE
 * the cutoff is rejected at verify time. This covers the 7-day first-party
 * Pointer session (the real risk window). Short-lived Privy bearers expire on
 * their own and their `iat` isn't surfaced, so the cutoff simply never applies
 * to them.
 *
 * Fail-open by design: if Redis is unavailable we never reject a cryptographically
 * valid token — availability beats a best-effort revocation list.
 */

const REVOKE_PREFIX = 'auth:revoked:';
// Matches the longest session lifetime (signPointerSession → 7d). After this
// the cutoff is moot: every pre-cutoff token has already expired on its own.
const REVOKE_TTL_SECONDS = 60 * 60 * 24 * 7;

export class SessionRevokedError extends Error {
  constructor() {
    super('session revoked');
    this.name = 'SessionRevokedError';
  }
}

function revokeKey(subject: string): string {
  return `${REVOKE_PREFIX}${subject}`;
}

/** Record a logout cutoff so every token for `subject` issued before now is rejected. */
export async function revokeSessionsForSubject(subject: string): Promise<void> {
  if (!subject) return;
  try {
    await getRedis().set(revokeKey(subject), String(Date.now()), { ex: REVOKE_TTL_SECONDS });
  } catch {
    /* best-effort — logout is still completed client-side */
  }
}

/**
 * Throw {@link SessionRevokedError} when this token was issued before the
 * subject's logout cutoff. No-op when we can't compare (no iat, no cutoff) or
 * when Redis is unreachable — fail-open, so a Redis outage never locks anyone out.
 */
export async function assertNotRevoked(subject: string, iatSeconds?: number): Promise<void> {
  if (!subject || !iatSeconds || !Number.isFinite(iatSeconds)) return;
  let cutoffMs: number | null = null;
  try {
    const v = await getRedis().get<string | number | null>(revokeKey(subject));
    cutoffMs = v == null ? null : Number(v);
  } catch {
    return; // fail-open
  }
  if (cutoffMs && Number.isFinite(cutoffMs) && iatSeconds * 1000 < cutoffMs) {
    throw new SessionRevokedError();
  }
}
