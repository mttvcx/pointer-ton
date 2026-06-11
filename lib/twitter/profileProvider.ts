/**
 * Twitter profile provider — swappable backend interface.
 *
 * The component layer talks to {@link getTwitterProfile} only; concrete provider
 * implementations (mock, TweetScout, SocialData, official X API, …) can be wired
 * behind it without touching the UI.
 */

/**
 * Mini-profile preview surfaced inside the Pulse Twitter HoverCard.
 *
 * Shape mirrors X / Twitter's own profile header — avatar + banner + identity +
 * meta row + follow stats. Tweet bodies are intentionally absent (the card is a
 * mini profile, not a tweet preview).
 */
export type TwitterProfile = {
  handle: string;
  displayName: string;
  verified: boolean;
  avatarUrl: string | null;
  /** Optional cover / header image; the card falls back to a gradient when absent. */
  bannerUrl: string | null;
  /** Captured for future use — not currently rendered. */
  bio: string | null;
  location: string | null;
  /** ISO date (YYYY-MM-DD or full ISO). */
  joinedAt: string;
  followingCount: number;
  followerCount: number;
  /** ISO timestamp of most recent observed activity. */
  lastActiveAt: string | null;
};

export interface TwitterProfileProvider {
  /** Resolves a Twitter / X handle (no leading `@`) to a {@link TwitterProfile}. */
  getProfile(handle: string): Promise<TwitterProfile>;
}

function isoMinutesAgo(min: number): string {
  return new Date(Date.now() - min * 60_000).toISOString();
}

const MOCK_FIXTURES: Record<string, TwitterProfile> = {
  elonmusk: {
    handle: 'elonmusk',
    displayName: 'Elon Musk',
    verified: true,
    avatarUrl: null,
    bannerUrl: null,
    bio: null,
    location: 'X',
    joinedAt: '2009-06-02',
    followingCount: 1_140,
    followerCount: 215_400_000,
    lastActiveAt: isoMinutesAgo(6),
  },
};

/** Deterministic mock — uses `MOCK_FIXTURES` when the handle is known, otherwise generates a stub. */
export const mockTwitterProvider: TwitterProfileProvider = {
  async getProfile(handle: string): Promise<TwitterProfile> {
    const key = handle.replace(/^@/, '').toLowerCase();
    if (MOCK_FIXTURES[key]) {
      return Promise.resolve({ ...MOCK_FIXTURES[key]! });
    }
    const seed = key.length || 1;
    return Promise.resolve({
      handle: key,
      displayName: key,
      verified: false,
      avatarUrl: null,
      bannerUrl: null,
      bio: null,
      location: null,
      joinedAt: '2021-01-01',
      followingCount: Math.max(20, (seed * 41) % 3200),
      followerCount: Math.max(50, (seed * 137) % 9000),
      lastActiveAt: isoMinutesAgo((seed * 7) % 120),
    });
  },
};

import { fetchFxTwitterProfile } from '@/lib/twitter/fxTwitterProfile';

/**
 * Active provider — FixTweet live profiles only. When the API fails the lookup
 * throws (route returns 502, UI renders `—`); live mode never fabricates
 * follower counts. Tests/demo can swap in `mockTwitterProvider` explicitly.
 */
let activeProvider: TwitterProfileProvider = {
  async getProfile(handle: string): Promise<TwitterProfile> {
    const live = await fetchFxTwitterProfile(handle);
    if (live) return live;
    throw new Error(`twitter_profile_unavailable:${handle.replace(/^@/, '')}`);
  },
};

export function setTwitterProfileProvider(p: TwitterProfileProvider): void {
  activeProvider = p;
}

export function getTwitterProfile(handle: string): Promise<TwitterProfile> {
  return activeProvider.getProfile(handle);
}
