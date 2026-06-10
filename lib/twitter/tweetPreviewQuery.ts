import {
  normalizeTwitterTweetPreview,
  type TwitterTweetPreview,
} from '@/lib/twitter/tweetPreviewTypes';

export const TWITTER_TWEET_PREVIEW_STALE_MS = 5 * 60_000;
export const TWITTER_TWEET_PREVIEW_GC_MS = 15 * 60_000;

export function twitterTweetPreviewQueryKey(url: string) {
  return ['twitter-tweet-preview', url.trim()] as const;
}

export async function fetchTwitterTweetPreview(url: string): Promise<TwitterTweetPreview> {
  const trimmed = url.trim();
  if (!trimmed) throw new Error('empty tweet url');
  const res = await fetch(`/api/twitter-preview?url=${encodeURIComponent(trimmed)}`);
  if (!res.ok) throw new Error(`tweet preview failed: ${res.status}`);
  return normalizeTwitterTweetPreview(await res.json());
}
