import 'server-only';

import { unstable_cache } from 'next/cache';
import { listPulseFeedTokens, listRecentTokens } from '@/lib/db/tokens';
import type { AppChainId } from '@/lib/chains/appChain';
import type { PulseColumnId } from '@/lib/utils/constants';

const PULSE_FEED_CACHE_SECONDS = 1;

/** Cached recent-token scan (NEW column wide candidate set). */
export async function cachedListRecentTokens(limit: number) {
  return unstable_cache(
    async () => listRecentTokens(limit),
    ['pulse', 'listRecentTokens', String(limit)],
    { revalidate: PULSE_FEED_CACHE_SECONDS, tags: ['pulse-feed'] },
  )();
}

/** Cached per-column Pulse feed rows (NEW / STRETCH / MIGRATED). */
export async function cachedListPulseFeedTokens(
  column: PulseColumnId,
  chain: AppChainId,
  limit: number,
) {
  return unstable_cache(
    async () => listPulseFeedTokens(column, chain, limit),
    ['pulse', 'listPulseFeedTokens', column, chain, String(limit)],
    { revalidate: PULSE_FEED_CACHE_SECONDS, tags: ['pulse-feed', `pulse-feed-${column}`] },
  )();
}
