import 'server-only';

import { listMintSwapsSince } from '@/lib/db/mintSwaps';
import { aggregateGlobalWalletStats } from '@/lib/indexer/aggregateGlobalWalletStats';

export async function runAggregateWalletStats(): Promise<{ upserted: number; swaps: number }> {
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const swaps = await listMintSwapsSince(since);
  const { upserted } = await aggregateGlobalWalletStats(swaps);
  return { upserted, swaps: swaps.length };
}
