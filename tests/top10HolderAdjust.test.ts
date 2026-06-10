import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computeAdjustedTop10HolderPct,
  computeTop10HolderPct,
} from '../lib/onchain/dedupeTokenHolders';
import type { TokenHolderRow } from '../lib/db/tokens';

function row(wallet: string, pct: number, rank: number): TokenHolderRow {
  return {
    id: rank,
    mint: 'test',
    wallet_address: wallet,
    amount_raw: '1',
    pct_of_supply: pct,
    is_dev: false,
    is_sniper: false,
    rank,
    computed_at: new Date().toISOString(),
  };
}

describe('computeAdjustedTop10HolderPct', () => {
  it('excludes LP pool from top 10 concentration', () => {
    const lp = 'DWKkgAHUgyf9n6wpyxi7KmVgrQwNjoVERFiTVhLgNT6m';
    const rows = [
      row(lp, 37.94, 1),
      row('wallet2', 3.02, 2),
      row('wallet3', 2.98, 3),
      row('wallet4', 2.31, 4),
      row('wallet5', 2.19, 5),
      row('wallet6', 2.16, 6),
      row('wallet7', 1.97, 7),
      row('wallet8', 1.9, 8),
      row('wallet9', 1.8, 9),
      row('wallet10', 1.7, 10),
    ];
    const raw = computeTop10HolderPct(rows);
    const adjusted = computeAdjustedTop10HolderPct(rows, new Set([lp]));
    assert.ok(raw != null && raw > 55);
    assert.ok(adjusted != null && adjusted < raw);
    assert.ok(adjusted != null && adjusted < 25);
  });
});
