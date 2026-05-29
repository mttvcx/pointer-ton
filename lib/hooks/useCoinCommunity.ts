'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { CoinCommunitySummary } from '@/lib/communities/coinCommunity';
import { coinCommunityInitialPreview } from '@/lib/communities/coinCommunityDemoPreview';
import {
  COIN_COMMUNITY_GC_MS,
  COIN_COMMUNITY_STALE_MS,
  coinCommunityQueryKey,
  fetchCoinCommunity,
} from '@/lib/communities/coinCommunityQuery';

export { coinCommunityQueryKey, fetchCoinCommunity } from '@/lib/communities/coinCommunityQuery';

/**
 * Reads a token's {@link CoinCommunitySummary} (community stats + recent messages).
 * Mirrors {@link useTwitterProfile}: stale entries render instantly on hover while a
 * background refetch runs.
 */
export function useCoinCommunity(
  mint: string | null | undefined,
  options: { enabled?: boolean } = {},
): UseQueryResult<CoinCommunitySummary, Error> {
  const trimmed = mint?.trim() ?? '';
  const seed = coinCommunityInitialPreview(trimmed);
  return useQuery<CoinCommunitySummary, Error>({
    queryKey: coinCommunityQueryKey(trimmed),
    queryFn: () => fetchCoinCommunity(trimmed),
    enabled: (options.enabled ?? true) && trimmed.length > 0,
    staleTime: COIN_COMMUNITY_STALE_MS,
    gcTime: COIN_COMMUNITY_GC_MS,
    initialData: seed,
    initialDataUpdatedAt: seed ? 0 : undefined,
    placeholderData: (previous) => previous ?? seed,
    retry: 1,
  });
}
