import type { TwitterProfile } from '@/lib/twitter/profileProvider';

/** Client cache TTL — profile data is considered fresh for 10 minutes. */
export const TWITTER_PROFILE_STALE_MS = 10 * 60_000;

export const TWITTER_PROFILE_GC_MS = 15 * 60_000;

export function normalizeTwitterHandle(handle: string | null | undefined): string {
  return handle?.replace(/^@/, '').trim() ?? '';
}

export function twitterProfileQueryKey(handle: string) {
  return ['twitter-profile', normalizeTwitterHandle(handle)] as const;
}

export async function fetchTwitterProfile(handle: string): Promise<TwitterProfile> {
  const trimmed = normalizeTwitterHandle(handle);
  if (!trimmed) throw new Error('empty twitter handle');
  const r = await fetch(`/api/twitter/profile/${encodeURIComponent(trimmed)}`);
  if (!r.ok) throw new Error(`profile fetch failed: ${r.status}`);
  return (await r.json()) as TwitterProfile;
}
