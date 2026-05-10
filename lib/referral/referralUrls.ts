/**
 * Canonical invite links use an Axiom-style path: `https://<site>/@CODE`
 * (no query string). Edge proxy rewrites `/@CODE` → `/points?tab=referral&code=CODE`.
 */

/** Normalized public origin for referral URLs — prefers NEXT_PUBLIC_APP_URL when set. */
export function getReferralShareOrigin(): string {
  const env = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, '');
  if (typeof window !== 'undefined') {
    if (env) return env;
    return window.location.origin;
  }
  return env ?? '';
}

/**
 * Public invite URL shown in UI / clipboard (always absolute).
 * Uses NEXT_PUBLIC_APP_URL when defined so staging/prod links stay on the real domain.
 */
export function buildReferralInviteUrl(code: string): string {
  const origin = getReferralShareOrigin();
  const safe = encodeURIComponent(code.trim());
  if (!origin) {
    // Fallback if neither env nor window (shouldn't happen in browser).
    return `/@${safe}`;
  }
  return `${origin}/@${safe}`;
}
