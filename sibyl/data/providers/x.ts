import 'server-only';

import type { ProviderStatus, SocialFacts, TweetRef } from '@/sibyl/data/providers/types';
import { sibylForceMock } from '@/sibyl/config';

/**
 * X / Twitter — KOL posts, mentions, quote/reply velocity, CT sentiment. Env:
 * TWITTER_BEARER_TOKEN (shared with pointer-ton X monitor). Mock returns a
 * rising-velocity KOL set so SocialVelocityCard renders.
 * NOTE: the real search/recent fetch is not wired yet — flip REAL_IMPL when it is.
 */
const REAL_IMPL = false;

export function xStatus(): ProviderStatus {
  return {
    name: 'x',
    configured: Boolean(process.env.TWITTER_BEARER_TOKEN?.trim()) && REAL_IMPL && !sibylForceMock(),
    envVars: ['TWITTER_BEARER_TOKEN'],
    note: REAL_IMPL ? 'CT mentions + velocity.' : 'CT mentions + velocity. Key present; real fetch pending (mock).',
  };
}

export async function getSocialFacts(query: string): Promise<SocialFacts> {
  if (!REAL_IMPL || sibylForceMock() || !process.env.TWITTER_BEARER_TOKEN?.trim()) {
    return {
      velocity: 'rising',
      handleCount: 6,
      window: '6h',
      mentions: [
        { handle: 'cented7', name: 'Cented', note: 'called it early, still holding' },
        { handle: 'gh0stee', name: 'Ghost', note: 'quote-tweeted the chart' },
        { handle: 'ripjalens', name: 'Jalen', note: 'watching, no entry' },
      ],
      source: 'x:mock',
    };
  }
  // TODO: search/recent for the ticker/CA, aggregate handles + velocity.
  return { velocity: 'unknown', handleCount: 0, window: '6h', mentions: [], source: 'x' };
}

/**
 * Real tweets for a ticker/CA via X API v2 recent search (bearer). Returns the
 * highest-engagement posts so Sibyl can cite the actual tweets driving a token /
 * meta. Gated on TWITTER_BEARER_TOKEN + search access; returns [] gracefully when
 * the key is absent, forced-mock, or the API tier lacks recent-search (403).
 */
export async function getRecentTweets(query: string, max = 5): Promise<TweetRef[]> {
  const token = process.env.TWITTER_BEARER_TOKEN?.trim();
  const q = query.trim();
  if (!token || sibylForceMock() || !q) return [];
  try {
    const search = `${q} -is:retweet -is:reply lang:en`;
    const url =
      `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(search)}` +
      `&max_results=20&tweet.fields=public_metrics&expansions=author_id&user.fields=username`;
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(6000) });
    if (!res.ok) return [];
    const j = (await res.json()) as {
      data?: Array<{ id: string; author_id?: string; public_metrics?: { like_count?: number; retweet_count?: number } }>;
      includes?: { users?: Array<{ id: string; username?: string }> };
    };
    const users = new Map((j.includes?.users ?? []).map((u) => [u.id, u.username]));
    return (j.data ?? [])
      .map((t) => ({
        url: `https://x.com/${(t.author_id ? users.get(t.author_id) : null) ?? 'i'}/status/${t.id}`,
        handle: (t.author_id ? users.get(t.author_id) : null) ?? null,
        likes: t.public_metrics?.like_count ?? 0,
      }))
      .sort((a, b) => b.likes - a.likes)
      .slice(0, max)
      .map((t): TweetRef => ({ url: t.url, handle: t.handle, note: t.likes ? `${t.likes.toLocaleString()} likes` : null }));
  } catch {
    return [];
  }
}
