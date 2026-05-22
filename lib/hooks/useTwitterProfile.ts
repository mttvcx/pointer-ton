'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { TwitterProfile } from '@/lib/twitter/profileProvider';
import {
  fetchTwitterProfile,
  normalizeTwitterHandle,
  TWITTER_PROFILE_GC_MS,
  TWITTER_PROFILE_STALE_MS,
  twitterProfileQueryKey,
} from '@/lib/twitter/twitterProfileQuery';

export {
  fetchTwitterProfile,
  normalizeTwitterHandle,
  twitterProfileQueryKey,
  TWITTER_PROFILE_STALE_MS,
} from '@/lib/twitter/twitterProfileQuery';

/**
 * Reads a {@link TwitterProfile} from the React Query cache (prefetched on row visibility).
 * Stale entries (>10 min) render immediately on hover while a background refetch runs.
 */
export function useTwitterProfile(
  handle: string | null | undefined,
  options: { enabled?: boolean } = {},
): UseQueryResult<TwitterProfile, Error> {
  const trimmed = normalizeTwitterHandle(handle);
  return useQuery<TwitterProfile, Error>({
    queryKey: twitterProfileQueryKey(trimmed),
    queryFn: () => fetchTwitterProfile(trimmed),
    enabled: (options.enabled ?? true) && trimmed.length > 0,
    staleTime: TWITTER_PROFILE_STALE_MS,
    gcTime: TWITTER_PROFILE_GC_MS,
    placeholderData: (previous) => previous,
    retry: 1,
  });
}
