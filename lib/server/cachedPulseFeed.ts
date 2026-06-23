import 'server-only';

import { getPulseFeed } from '@/lib/helius/feed';
import type { AppChainId } from '@/lib/chains/appChain';
import type { PulseColumnId } from '@/lib/utils/constants';

type FeedValue = Awaited<ReturnType<typeof getPulseFeed>>;
type Entry = { value: FeedValue; at: number; refreshing: boolean };

/**
 * Stale-while-revalidate cache for the FULLY-ENRICHED Pulse feed.
 *
 * getPulseFeed runs a heavy pipeline (cold poll + DexScreener enrich + metrics
 * enrich) that previously reran on EVERY request because only the raw DB rows
 * were cached (1s TTL), not the enriched result. The feed is identical for all
 * users of a given (column, chain), so we cache the enriched bundles in-process:
 *
 *   age < FRESH_MS  → serve cached, no work
 *   age < STALE_MS  → serve cached instantly, refresh once in the background
 *   older / cold    → block on a fresh compute
 *
 * In-process (per serverless instance) by design — no 2MB unstable_cache limit,
 * no cross-request promise-leak risk, and a warm instance serves the feed to
 * many concurrent users from one pipeline run.
 */
const FRESH_MS = 4_000;
const STALE_MS = 20_000;

const cache = new Map<string, Entry>();

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
        void getPulseFeed(column, chain)
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

  const value = await getPulseFeed(column, chain);
  cache.set(key, { value, at: Date.now(), refreshing: false });
  return value;
}
