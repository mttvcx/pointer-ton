import 'server-only';

import type { TwitterProfile } from '@/lib/twitter/profileProvider';

type FxUser = {
  screen_name?: string;
  name?: string;
  avatar_url?: string;
  banner_url?: string;
  description?: string;
  location?: string;
  joined?: string;
  following?: number;
  followers?: number;
  verification?: { verified?: boolean; type?: string };
  protected?: boolean;
};

type FxUserResponse = {
  user?: FxUser;
};

function hiResAvatar(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  return url.replace(/_normal\.(jpg|png|webp)$/i, '.$1');
}

function parseJoined(raw: string | undefined): string {
  if (!raw?.trim()) return '2020-01-01';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return raw.trim().slice(0, 10);
  return d.toISOString().slice(0, 10);
}

function mapFxUser(u: FxUser): TwitterProfile {
  const handle = u.screen_name?.trim().replace(/^@/, '') ?? '';
  return {
    handle,
    displayName: u.name?.trim() || handle,
    verified: u.verification?.verified === true,
    avatarUrl: hiResAvatar(u.avatar_url),
    bannerUrl: u.banner_url?.trim() || null,
    bio: u.description?.trim() || null,
    location: u.location?.trim() || null,
    joinedAt: parseJoined(u.joined),
    followingCount: typeof u.following === 'number' ? u.following : 0,
    followerCount: typeof u.followers === 'number' ? u.followers : 0,
    lastActiveAt: null,
  };
}

export async function fetchFxTwitterProfile(handle: string): Promise<TwitterProfile | null> {
  const key = handle.replace(/^@/, '').trim();
  if (!key) return null;
  try {
    const res = await fetch(`https://api.fxtwitter.com/${encodeURIComponent(key)}`, {
      headers: { Accept: 'application/json', 'User-Agent': 'Mozilla/5.0 (compatible; Pointer/1.0)' },
      next: { revalidate: 600 },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as FxUserResponse;
    if (!json.user?.screen_name) return null;
    return mapFxUser(json.user);
  } catch {
    return null;
  }
}
