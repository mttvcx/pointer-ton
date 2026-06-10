import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { dedupeTokenHolderRows } from '@/lib/onchain/dedupeTokenHolders';
import { dedupeMintSwapsForDesk } from '@/lib/indexer/dedupeMintSwapsForDesk';
import type { MintSwapRow } from '@/lib/db/mintSwaps';
import type { TokenHolderRow } from '@/lib/db/tokens';

function holder(wallet: string, rank: number, pct: number): TokenHolderRow {
  return {
    id: rank,
    mint: 'mint',
    wallet_address: wallet,
    amount_raw: '1000',
    pct_of_supply: pct,
    is_dev: null,
    is_sniper: null,
    rank,
    computed_at: new Date().toISOString(),
  };
}

function swap(sig: string, overrides: Partial<MintSwapRow> = {}): MintSwapRow {
  return {
    id: sig,
    mint: 'mint',
    signature: sig,
    wallet: 'w1',
    side: 'buy',
    token_amount_ui: 1,
    sol_amount_ui: 0.1,
    price_usd: 1,
    usd_amount: 1,
    block_time: '2026-06-07T00:00:00Z',
    event_kind: 'swap',
    ...overrides,
  } as MintSwapRow;
}

describe('dedupeTokenHolderRows', () => {
  it('merges duplicate wallets and re-ranks', () => {
    const rows = [holder('AAA', 1, 50), holder('AAA', 2, 50), holder('BBB', 3, 10)];
    const out = dedupeTokenHolderRows(rows);
    assert.equal(out.length, 2);
    assert.deepEqual(
      out.map((r) => r.wallet_address),
      ['AAA', 'BBB'],
    );
    assert.deepEqual(
      out.map((r) => r.rank),
      [1, 2],
    );
  });
});

describe('dedupeMintSwapsForDesk', () => {
  it('keeps one row per signature, preferring remove_liq', () => {
    const rows = [
      swap('sig1', { side: 'sell', event_kind: 'swap' }),
      swap('sig1', { side: 'sell', event_kind: 'remove_liq', id: 99 }),
      swap('sig2', { event_kind: 'swap' }),
    ];
    const out = dedupeMintSwapsForDesk(rows);
    assert.equal(out.length, 2);
    const sig1 = out.find((r) => r.signature === 'sig1');
    assert.equal(sig1?.event_kind, 'remove_liq');
  });
});
