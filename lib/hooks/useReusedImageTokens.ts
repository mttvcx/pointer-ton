'use client';

import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import {
  REUSED_IMAGE_GC_MS,
  REUSED_IMAGE_STALE_MS,
  fetchReusedImageTokens,
  reusedImageQueryKey,
  type ReusedImageResponse,
} from '@/lib/tokens/reusedImageQuery';

/** Fetch tokens that reuse the same image — hover-only in Pulse avatar preview. */
export function useReusedImageTokens(
  imageUrl: string | null | undefined,
  excludeMint: string,
  options: { enabled?: boolean } = {},
): UseQueryResult<ReusedImageResponse, Error> {
  const url = imageUrl?.trim() ?? '';
  const mint = excludeMint.trim();
  return useQuery<ReusedImageResponse, Error>({
    queryKey: reusedImageQueryKey(url, mint),
    queryFn: () => fetchReusedImageTokens(url, mint),
    enabled: (options.enabled ?? true) && url.length > 0 && mint.length > 0,
    staleTime: REUSED_IMAGE_STALE_MS,
    gcTime: REUSED_IMAGE_GC_MS,
    retry: 1,
  });
}
