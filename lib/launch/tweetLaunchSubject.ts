import { hashContext } from '@/lib/utils/hashContext';
import { normalizeTwitterHandle } from '@/lib/alerts/solMintFromText';
import type { TweetLaunchInput } from '@/lib/launch/types';

/** Extract X status id from a tweet URL when present. */
export function tweetIdFromUrl(tweetUrl?: string | null): string | null {
  if (!tweetUrl?.trim()) return null;
  const m = tweetUrl.match(/status\/(\d{8,25})/i);
  return m?.[1] ?? null;
}

/**
 * Global cache subject for a tweet — same tweet → same key for all users.
 * Prefer platform tweet id; fall back to content hash.
 */
export function tweetLaunchCacheSubject(tweet: TweetLaunchInput): string {
  const id = tweet.id?.trim() || tweetIdFromUrl(tweet.tweetUrl) || '';
  if (id) return id;
  const handle = normalizeTwitterHandle(tweet.authorHandle) ?? tweet.authorHandle.trim().toLowerCase();
  const images = [...(tweet.imageUrls ?? [])].map((u) => u.trim()).filter(Boolean).sort();
  return hashContext({
    text: tweet.text.trim().slice(0, 4000),
    handle,
    images,
  });
}
