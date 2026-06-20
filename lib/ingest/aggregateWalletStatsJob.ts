import 'server-only';

import { listAllMintSwapsSince } from '@/lib/db/mintSwaps';
import { aggregateGlobalWalletStats } from '@/lib/indexer/aggregateGlobalWalletStats';

export async function runAggregateWalletStats(): Promise<{ upserted: number; swaps: number }> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  // Paginate past PostgREST's 1000-row cap — otherwise wallet_stats is computed
  // from only the oldest 1000 swaps in the 30d window.
  const swaps = await listAllMintSwapsSince(since);
  const { upserted } = await aggregateGlobalWalletStats(swaps);
  return { upserted, swaps: swaps.length };
}
