import type { QueryClient } from '@tanstack/react-query';
import {
  COIN_COMMUNITY_STALE_MS,
  coinCommunityQueryKey,
  fetchCoinCommunity,
} from '@/lib/communities/coinCommunityQuery';

const MAX_CONCURRENT = 4;

const queued = new Set<string>();
const inFlight = new Set<string>();
const queue: string[] = [];
let activeCount = 0;

function isFreshInCache(queryClient: QueryClient, mint: string): boolean {
  const state = queryClient.getQueryState(coinCommunityQueryKey(mint));
  if (!state?.dataUpdatedAt) return false;
  return Date.now() - state.dataUpdatedAt < COIN_COMMUNITY_STALE_MS;
}

function isFetchingInReactQuery(queryClient: QueryClient, mint: string): boolean {
  return queryClient.getQueryState(coinCommunityQueryKey(mint))?.fetchStatus === 'fetching';
}

function shouldEnqueue(queryClient: QueryClient, mint: string): boolean {
  if (!mint) return false;
  if (queued.has(mint) || inFlight.has(mint)) return false;
  if (isFreshInCache(queryClient, mint)) return false;
  if (isFetchingInReactQuery(queryClient, mint)) return false;
  return true;
}

function drain(queryClient: QueryClient): void {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const mint = queue.shift()!;
    queued.delete(mint);

    if (isFreshInCache(queryClient, mint) || isFetchingInReactQuery(queryClient, mint)) {
      continue;
    }
    if (inFlight.has(mint)) continue;

    inFlight.add(mint);
    activeCount++;

    void queryClient
      .prefetchQuery({
        queryKey: coinCommunityQueryKey(mint),
        queryFn: () => fetchCoinCommunity(mint),
        staleTime: COIN_COMMUNITY_STALE_MS,
      })
      .finally(() => {
        inFlight.delete(mint);
        activeCount--;
        drain(queryClient);
      });
  }
}

/** Queue a background community fetch (deduped by mint). */
export function enqueueCoinCommunityPrefetch(
  queryClient: QueryClient,
  mint: string | null | undefined,
): void {
  const trimmed = mint?.trim() ?? '';
  if (!shouldEnqueue(queryClient, trimmed)) return;

  queued.add(trimmed);
  queue.push(trimmed);
  drain(queryClient);
}
