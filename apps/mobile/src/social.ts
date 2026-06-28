/**
 * Social helpers — real X (Twitter) profile pics by handle, the SAME pics the web
 * app shows. We resolve via unavatar (handle -> real avatar) instead of generated
 * cartoon illustrations, so a tracked KOL like @cupseyy renders their actual photo.
 */

/** Real X avatar for a handle (unavatar serves a clean neutral fallback for unknowns). */
export function xAvatarUrl(handle: string): string {
  const h = handle.replace(/^@/, '').trim().toLowerCase();
  return `https://unavatar.io/x/${encodeURIComponent(h)}`;
}

/** Compact follower/following count (12.4K, 1.2M) — no currency symbol. */
export function compactCount(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(n >= 10_000_000 ? 0 : 1)}M`.replace('.0', '');
  if (n >= 1_000) return `${(n / 1_000).toFixed(n >= 10_000 ? 0 : 1)}K`.replace('.0', '');
  return String(Math.round(n));
}

/**
 * Real Solana KOLs (from the web axiom-kol seed) for the demo X-monitor marquee,
 * each tied to a demo-token shout. Real handles -> real avatars via {@link xAvatarUrl}.
 */
export const DEMO_KOL_TWEETS: { handle: string; name: string; text: string }[] = [
  { handle: 'cupseyy', name: 'Cupsey', text: 'aped $piss, chart primed, 30 buys in 8h' },
  { handle: 'ohzarke', name: 'Ozark', text: '$SPCX69 holding the 8% dip, smart money still in' },
  { handle: 'vibed333', name: 'dvces', text: 'new CA I track, $XGIFT up 827% 24h' },
  { handle: 'kadenox', name: 'Kadenox', text: '$world.xyz quietly climbing, 174k liq' },
  { handle: 'lilmoonlambo', name: 'LilmoonLambo', text: 'watching $RTM, 993% but liq thin, careful' },
];
