import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import type { MintSwapRow } from '@/lib/db/mintSwaps';
import { computeWalletStatsRowsFromSwaps } from '@/lib/indexer/computeWalletStatsRows';

function swap(partial: Partial<MintSwapRow> & Pick<MintSwapRow, 'wallet' | 'side'>): MintSwapRow {
  const now = new Date().toISOString();
  return {
    id: 1,
    mint: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
    signature: 'sig',
    wallet: partial.wallet,
    event_kind: 'swap',
    side: partial.side,
    token_amount_raw: 1_000_000,
    token_amount_ui: partial.token_amount_ui ?? 100,
    sol_amount: partial.sol_amount ?? 1,
    usd_amount: partial.usd_amount ?? 100,
    price_usd: partial.price_usd ?? 1,
    market_cap_usd: null,
    block_time: partial.block_time ?? now,
    slot: null,
    program_id: null,
    pool_address: null,
    source: 'test',
    created_at: now,
  };
}

describe('wallet_stats aggregation', () => {
  it('computes positive 30d PnL from buy then sell', () => {
    const wallet = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
    const t0 = new Date(Date.now() - 86400000 * 3).toISOString();
    const t1 = new Date(Date.now() - 86400000 * 2).toISOString();

    const rows = computeWalletStatsRowsFromSwaps([
      swap({ wallet, side: 'buy', block_time: t0, usd_amount: 100, price_usd: 1 }),
      swap({ wallet, side: 'sell', block_time: t1, usd_amount: 150, price_usd: 1.5 }),
    ]);

    assert.equal(rows.length, 1);
    assert.ok(rows[0]!.pnl_usd_30d > 0);
    assert.equal(rows[0]!.trades_30d, 2);
    assert.equal(rows[0]!.is_kol, true);
  });
});
