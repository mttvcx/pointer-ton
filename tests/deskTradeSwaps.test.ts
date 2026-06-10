import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  dedupeMintSwapsForTradeDesk,
  filterDeskTradeSwaps,
  isDeskTradeSwap,
} from '@/lib/indexer/deskTradeSwaps';
import { computeTop10HolderPct } from '@/lib/onchain/dedupeTokenHolders';
import type { MintSwapRow } from '@/lib/db/mintSwaps';
import type { TokenHolderRow } from '@/lib/db/tokens';

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

describe('deskTradeSwaps', () => {
  it('excludes remove_liq from trade tape', () => {
    const rows = [
      swap('a', { event_kind: 'remove_liq', side: 'sell', sol_amount: 300 }),
      swap('b', { event_kind: 'swap', side: 'buy' }),
    ];
    assert.equal(filterDeskTradeSwaps(rows).length, 1);
    assert.equal(isDeskTradeSwap(rows[1]!), true);
    assert.equal(isDeskTradeSwap(rows[0]!), false);
  });

  it('dedupes trade desk preferring swap legs', () => {
    const rows = [
      swap('sig1', { side: 'sell', event_kind: 'swap' }),
      swap('sig1', { side: 'sell', event_kind: 'remove_liq', id: 99, sol_amount: 300 }),
      swap('sig2', { event_kind: 'swap' }),
    ];
    const out = dedupeMintSwapsForTradeDesk(rows);
    assert.equal(out.length, 2);
    const sig1 = out.find((r) => r.signature === 'sig1');
    assert.equal(sig1?.event_kind, 'swap');
  });
});

describe('computeTop10HolderPct', () => {
  it('caps top10 at 100%', () => {
    const rows: TokenHolderRow[] = [
      {
        id: 1,
        mint: 'm',
        wallet_address: 'a',
        amount_raw: '1',
        pct_of_supply: 50,
        is_dev: null,
        is_sniper: null,
        rank: 1,
        computed_at: '',
      },
      {
        id: 2,
        mint: 'm',
        wallet_address: 'a',
        amount_raw: '1',
        pct_of_supply: 50,
        is_dev: null,
        is_sniper: null,
        rank: 2,
        computed_at: '',
      },
    ];
    assert.equal(computeTop10HolderPct(rows), 100);
  });
});
