import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  holderRowMatchesFilter,
  traderRowMatchesFilter,
  resolveRecognizedForTraderFilter,
} from '@/lib/walletIdentity/traderFilters';

import { demoWalletAt } from '@/lib/dev/demoTokenFixtures';

const DOJI = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';
const UNKNOWN = demoWalletAt(999);

describe('traderFilters live KOL registry', () => {
  it('resolveRecognizedForTraderFilter finds seeded Kolscan wallet without demo flag', () => {
    const rec = resolveRecognizedForTraderFilter({ chain: 'sol', address: DOJI });
    assert.ok(rec);
    assert.ok(rec!.badges.includes('kol'));
    assert.equal(rec!.displayName, 'Doji');
  });

  it('mock directory is gated behind allowDemoDirectory', () => {
    const live = resolveRecognizedForTraderFilter({ chain: 'sol', address: DOJI });
    assert.notEqual(live?.displayName, 'sanuxo');
    const demo = resolveRecognizedForTraderFilter({
      chain: 'sol',
      address: DOJI,
      allowDemoDirectory: true,
    });
    assert.ok(demo);
  });

  it('KOL filter matches registry seed in live mode', () => {
    const row = {
      wallet_address: DOJI,
      realized_pnl_usd: 100,
      buy_token_qty: 10,
      sell_token_qty: 2,
      first_trade_at: new Date().toISOString(),
    } as Parameters<typeof traderRowMatchesFilter>[0]['row'];

    assert.equal(
      traderRowMatchesFilter({
        row,
        chain: 'sol',
        creatorWallet: null,
        tracked: false,
        labelDisp: null,
        filter: 'kol',
        allowDemoDirectory: false,
      }),
      true,
    );

    assert.equal(
      traderRowMatchesFilter({
        row: { ...row, wallet_address: UNKNOWN },
        chain: 'sol',
        creatorWallet: null,
        tracked: false,
        labelDisp: null,
        filter: 'kol',
        allowDemoDirectory: false,
      }),
      false,
    );
  });

  it('holder KOL filter uses registry smart money badge', () => {
    const cented = 'CenNtDkUuZUV2T36rFq2EMEa6Wk3aouREJFqJa3Yk1iB';
    assert.equal(
      holderRowMatchesFilter({
        row: { wallet_address: cented, pct_of_supply: 1, is_dev: false, is_sniper: false },
        chain: 'sol',
        creatorWallet: null,
        tracked: false,
        labelDisp: null,
        filter: 'smart_money',
        allowDemoDirectory: false,
      }),
      true,
    );
  });
});
