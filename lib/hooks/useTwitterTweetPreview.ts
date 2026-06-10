'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { TwitterTweetPreview } from '@/lib/twitter/tweetPreviewTypes';
import {
  fetchTwitterTweetPreview,
  TWITTER_TWEET_PREVIEW_GC_MS,
  TWITTER_TWEET_PREVIEW_STALE_MS,
  twitterTweetPreviewQueryKey,
} from '@/lib/twitter/tweetPreviewQuery';
import { normalizeTwitterTweetPreview } from '@/lib/twitter/tweetPreviewTypes';

export function useTwitterTweetPreview(
  url: string | null | undefined,
  options: { enabled?: boolean } = {},
): UseQueryResult<TwitterTweetPreview, Error> {
  const trimmed = url?.trim() ?? '';
  return useQuery<TwitterTweetPreview, Error>({
    queryKey: twitterTweetPreviewQueryKey(trimmed),
    queryFn: () => fetchTwitterTweetPreview(trimmed),
    enabled: (options.enabled ?? true) && trimmed.length > 0,
    staleTime: TWITTER_TWEET_PREVIEW_STALE_MS,
    gcTime: TWITTER_TWEET_PREVIEW_GC_MS,
    placeholderData: (previous) => (previous ? normalizeTwitterTweetPreview(previous) : undefined),
    select: (data) => normalizeTwitterTweetPreview(data),
    retry: 1,
  });
}
