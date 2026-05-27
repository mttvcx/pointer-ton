import 'server-only';

import { unstable_cache } from 'next/cache';
import { listPulseFeedTokens, listRecentTokens } from '@/lib/db/tokens';
import type { AppChainId } from '@/lib/chains/appChain';
import type { PulseColumnId } from '@/lib/utils/constants';

const PULSE_FEED_CACHE_SECONDS = 1;

/**
 * Recent-token scan for wide-chain backfill.
 *
 * Intentionally NOT wrapped in `unstable_cache`: the 1500-row payload routinely
 * exceeds Next 16's hard 2MB per-entry limit, and a rejected cache-set leaks
 * the resolved promise reference — over hours of polling that OOM'd the dev
 * server. The 1s TTL we'd save is negligible vs. that failure mode.
 */
export async function cachedListRecentTokens(limit: number) {
  return listRecentTokens(limit);
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
