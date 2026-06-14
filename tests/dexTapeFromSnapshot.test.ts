import assert from 'node:assert/strict';
import test from 'node:test';
import { dexTapeFromSnapshot } from '@/lib/market/dexTapeFromSnapshot';
import type { TokenMarketSnapshotRow } from '@/lib/db/tokens';

function snap(partial: Partial<TokenMarketSnapshotRow>): TokenMarketSnapshotRow {
  return {
    id: 1,
    mint: 'mint',
    market_cap_usd: null,
    liquidity_usd: null,
    price_usd: null,
    volume_5m_usd: null,
    volume_1h_usd: null,
    volume_24h_usd: null,
    txns_5m: null,
    txns_1h: null,
    holder_count: null,
    top10_holder_pct: null,
    dev_holding_pct: null,
    extended_metrics: null,
    snapshot_at: new Date().toISOString(),
    ...partial,
  };
}

test('dexTapeFromSnapshot allocates buy/sell USD from txn ratio', () => {
  const tape = dexTapeFromSnapshot(
    snap({
      volume_1h_usd: 100,
      extended_metrics: {
        txnsH1Buys: 3,
        txnsH1Sells: 1,
      },
    }),
  );
  assert.equal(tape['1h']?.volUsd, 100);
  assert.equal(tape['1h']?.buys, 3);
  assert.equal(tape['1h']?.sells, 1);
  assert.equal(tape['1h']?.buyVolUsd, 75);
  assert.equal(tape['1h']?.sellVolUsd, 25);
  assert.equal(tape['1h']?.netVolUsd, 50);
  assert.notEqual(tape['1h']?.dexAggregate, true);
});

test('dexTapeFromSnapshot marks dexAggregate when txn split missing', () => {
  const tape = dexTapeFromSnapshot(
    snap({
      volume_24h_usd: 200,
      extended_metrics: {},
    }),
  );
  assert.equal(tape['24h']?.dexAggregate, true);
  assert.equal(tape['24h']?.netVolUsd, 0);
});
