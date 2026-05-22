import type { QueryClient } from '@tanstack/react-query';
import {
  fetchTwitterProfile,
  normalizeTwitterHandle,
  TWITTER_PROFILE_STALE_MS,
  twitterProfileQueryKey,
} from '@/lib/twitter/twitterProfileQuery';

const MAX_CONCURRENT = 5;

const queued = new Set<string>();
const inFlight = new Set<string>();
const queue: string[] = [];
let activeCount = 0;

function isFreshInCache(queryClient: QueryClient, handle: string): boolean {
  const state = queryClient.getQueryState(twitterProfileQueryKey(handle));
  if (!state?.dataUpdatedAt) return false;
  return Date.now() - state.dataUpdatedAt < TWITTER_PROFILE_STALE_MS;
}

function isFetchingInReactQuery(queryClient: QueryClient, handle: string): boolean {
  return queryClient.getQueryState(twitterProfileQueryKey(handle))?.fetchStatus === 'fetching';
}

function shouldEnqueue(queryClient: QueryClient, handle: string): boolean {
  if (!handle) return false;
  if (queued.has(handle) || inFlight.has(handle)) return false;
  if (isFreshInCache(queryClient, handle)) return false;
  if (isFetchingInReactQuery(queryClient, handle)) return false;
  return true;
}

function drain(queryClient: QueryClient): void {
  while (activeCount < MAX_CONCURRENT && queue.length > 0) {
    const handle = queue.shift()!;
    queued.delete(handle);

    if (isFreshInCache(queryClient, handle) || isFetchingInReactQuery(queryClient, handle)) {
      continue;
    }
    if (inFlight.has(handle)) continue;

    inFlight.add(handle);
    activeCount++;

    void queryClient
      .prefetchQuery({
        queryKey: twitterProfileQueryKey(handle),
        queryFn: () => fetchTwitterProfile(handle),
        staleTime: TWITTER_PROFILE_STALE_MS,
      })
      .finally(() => {
        inFlight.delete(handle);
        activeCount--;
        drain(queryClient);
      });
  }
}

/** Queue a background profile fetch (max 5 concurrent; deduped by handle). */
export function enqueueTwitterProfilePrefetch(
  queryClient: QueryClient,
  handle: string | null | undefined,
): void {
  const normalized = normalizeTwitterHandle(handle);
  if (!shouldEnqueue(queryClient, normalized)) return;

  queued.add(normalized);
  queue.push(normalized);
  drain(queryClient);
}
