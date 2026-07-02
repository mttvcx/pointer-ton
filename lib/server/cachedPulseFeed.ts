import 'server-only';

import { unstable_cache } from 'next/cache';
import { getPulseFeed } from '@/lib/helius/feed';
import type { AppChainId } from '@/lib/chains/appChain';
import type { PulseColumnId } from '@/lib/utils/constants';

type FeedValue = Awaited<ReturnType<typeof getPulseFeed>>;
type Entry = { value: FeedValue; at: number; refreshing: boolean };

/**
 * Two-layer stale-while-revalidate cache for the FULLY-ENRICHED Pulse feed.
 *
 * getPulseFeed runs a heavy pipeline (cold poll + DexScreener enrich + metrics
 * enrich). The feed is identical for all users of a given (column, chain), so:
 *
 *   L1 — in-process Map (this serverless instance): sub-ms for a warm instance.
 *        age < FRESH_MS → serve; age < STALE_MS → serve + refresh in background.
 *   L2 — Vercel Data Cache via unstable_cache: CROSS-INSTANCE + survives cold
 *        starts. A freshly-spawned instance (empty Map) reads L2 in ms instead
 *        of blocking on the 15s pipeline; the pipeline only runs on a true
 *        global miss (nothing computed anywhere in the last WARM window).
 *
 * If a bundle ever exceeds the 2MB Data Cache entry limit, unstable_cache simply
 * skips caching and recomputes — a graceful degrade to the old behaviour, never
 * a break.
 */
const FRESH_MS = 4_000;
const STALE_MS = 20_000;
/** Cross-instance Data Cache window (seconds). SWR: stale served, bg-revalidated. */
const WARM_REVALIDATE_S = 20;

const cache = new Map<string, Entry>();

/** L2: cross-instance warm feed. Keyed by (column, chain); serialised to JSON. */
function warmGetPulseFeed(column: PulseColumnId, chain: AppChainId): Promise<FeedValue> {
  return unstable_cache(
    () => getPulseFeed(column, chain),
    ['pulse-feed-warm-v1', column, chain],
    { revalidate: WARM_REVALIDATE_S, tags: ['pulse-feed', `pulse-feed:${column}:${chain}`] },
  )();
}

export async function cachedGetPulseFeed(
  column: PulseColumnId,
  chain: AppChainId,
): Promise<FeedValue> {
  const key = `${column}:${chain}`;
  const now = Date.now();
  const hit = cache.get(key);

  if (hit) {
    const age = now - hit.at;
    if (age < FRESH_MS) return hit.value;
    if (age < STALE_MS) {
      if (!hit.refreshing) {
        hit.refreshing = true;
        void warmGetPulseFeed(column, chain)
          .then((value) => cache.set(key, { value, at: Date.now(), refreshing: false }))
          .catch(() => {
            // Keep serving the last good value; clear the flag so the next
            // request can retry the refresh.
            const cur = cache.get(key);
            if (cur) cur.refreshing = false;
          });
      }
      return hit.value;
    }
  }

  // Cold instance / stale L1: read the cross-instance warm cache. Only a true
  // global miss falls through to the heavy pipeline (inside warmGetPulseFeed).
  const value = await warmGetPulseFeed(column, chain);
  cache.set(key, { value, at: Date.now(), refreshing: false });
  return value;
}

const WARM_COLUMNS: PulseColumnId[] = ['new', 'stretch', 'migrated'];

/**
 * Pre-computes the feed for the standard columns so the cross-instance warm
 * cache (L2) is never empty when the first user of a cold instance arrives.
 * Called from the enrich-pulse cron; best-effort (errors swallowed).
 */
export async function warmPulseFeeds(chains: AppChainId[] = ['sol']): Promise<void> {
  await Promise.all(
    chains.flatMap((chain) =>
      WARM_COLUMNS.map((column) => cachedGetPulseFeed(column, chain).catch(() => undefined)),
    ),
  );
}
