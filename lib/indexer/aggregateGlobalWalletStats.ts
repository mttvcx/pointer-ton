import 'server-only';

import type { MintSwapRow } from '@/lib/db/mintSwaps';
import { upsertWalletStats } from '@/lib/db/wallets';
import { prepareIdentityRegistry } from '@/lib/identity/importPersisted';
import { computeWalletStatsRowsFromSwaps } from '@/lib/indexer/computeWalletStatsRows';

/** Aggregate global wallet_stats from indexed mint_swaps (7d/30d PnL, win rate, volume). */
export async function aggregateGlobalWalletStats(
  swaps: MintSwapRow[],
): Promise<{ upserted: number }> {
  await prepareIdentityRegistry();
  const rows = computeWalletStatsRowsFromSwaps(swaps);
  let upserted = 0;
  for (const row of rows) {
    await upsertWalletStats({
      wallet_address: row.wallet,
      pnl_usd_30d: row.pnl_usd_30d,
      pnl_usd_7d: row.pnl_usd_7d,
      pnl_usd_24h: null,
      win_rate_30d: row.win_rate_30d,
      trades_30d: row.trades_30d,
      best_trade_multiple: null,
      avg_hold_seconds: null,
      total_volume_30d_usd: row.total_volume_30d_usd,
      is_kol: row.is_kol,
      kol_handle: row.kol_handle,
      computed_at: new Date().toISOString(),
    });
    upserted += 1;
  }
  return { upserted };
}

export { computeWalletStatsRowsFromSwaps } from '@/lib/indexer/computeWalletStatsRows';
