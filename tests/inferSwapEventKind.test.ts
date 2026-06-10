import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { inferSwapEventKind } from '@/lib/indexer/inferSwapEventKind';

describe('inferSwapEventKind', () => {
  it('detects remove-liq from large SOL sell (QA pool withdraw)', () => {
    assert.equal(
      inferSwapEventKind({
        event_kind: 'swap',
        source: 'helius_pump_amm',
        side: 'sell',
        sol_amount: 338.11,
        token_amount_ui: 500_000,
        pool_address: '8YAyrz42UK6dtDUHga58esyBzSpjqLYovj9RkLusnMA1',
      }),
      'remove_liq',
    );
  });

  it('keeps normal swaps as swap', () => {
    assert.equal(
      inferSwapEventKind({
        event_kind: 'swap',
        source: 'helius_pump_amm',
        side: 'sell',
        sol_amount: 0.6,
        token_amount_ui: 12_000,
        pool_address: '8YAyrz42UK6dtDUHga58esyBzSpjqLYovj9RkLusnMA1',
      }),
      'swap',
    );
  });
});
