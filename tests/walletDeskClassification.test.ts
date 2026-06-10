import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { poolRoleDisplayLabel } from '@/lib/onchain/poolWalletTypes';
import {
  classifyWalletForDesk,
  detectSniperFromStats,
} from '@/lib/onchain/walletDeskClassification';

const POOL = '8YAyrz42UK6dtDUHga58esyBzSpjqLYovj9RkLusnMA1';
const CREATOR = 'DevWallet11111111111111111111111111111111';

describe('walletDeskClassification', () => {
  it('locked vault keeps wallet visible (no LOCKED forced label)', () => {
    const cls = classifyWalletForDesk({
      address: '62qc2CNXwrYqQScmEdiZFFAnJR262PxWEuNQtxfafNgV',
      pctSupply: 49.81,
      lockedVaultTooltip: 'Locked 49.81% supply · SPL token account · 62qc2…',
    });
    assert.equal(cls.displayLabel, null);
    assert.equal(cls.role, 'locked_vault');
    assert.equal(cls.isSystemAccount, true);
    assert.equal(cls.lockedVaultTooltip?.includes('49.81'), true);
  });

  it('labels LP pool addresses', () => {
    const cls = classifyWalletForDesk({
      address: POOL,
      poolRole: 'lp',
    });
    assert.equal(cls.displayLabel, 'LIQUIDITY POOL');
    assert.equal(cls.isSystemAccount, true);
    assert.equal(poolRoleDisplayLabel('lp'), 'LIQUIDITY POOL');
  });

  it('fresh badge only when isFreshFunded from funding ingest', () => {
    const fresh = classifyWalletForDesk({
      address: 'FreshWallet1111111111111111111111111111',
      isFreshFunded: true,
      funding: {
        venue: 'Coinbase',
        ageSinceFund: '2d',
        solFunding: '0.5',
        txCount: 1,
        sharedFundedCount: 1,
      },
    });
    assert.ok(fresh.badges.includes('fresh'));
    assert.equal(fresh.isFresh, true);

    const stale = classifyWalletForDesk({
      address: 'OldWallet11111111111111111111111111111',
      walletStats: {
        mint: 'm',
        wallet: 'w',
        bought_token_raw: 1,
        sold_token_raw: 0,
        buy_sol: 1,
        sell_sol: 0,
        buy_usd: 1,
        sell_usd: 0,
        avg_buy_usd: 1,
        avg_sell_usd: null,
        realized_pnl_usd: 0,
        unrealized_pnl_usd: 0,
        remaining_token_raw: 1,
        remaining_token_ui: 1,
        first_trade_at: new Date().toISOString(),
        last_trade_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      tokenCreatedAt: new Date().toISOString(),
      isFreshFunded: false,
    });
    assert.equal(stale.isFresh, false);
    assert.ok(!stale.badges.includes('fresh'));
  });

  it('flags dev wallet from creator match', () => {
    const cls = classifyWalletForDesk({
      address: CREATOR,
      creatorWallet: CREATOR,
    });
    assert.equal(cls.isDev, true);
    assert.ok(cls.badges.includes('dev'));
  });

  it('detects sniper from launch-window fast exit stats', () => {
    const launch = '2026-06-07T12:00:00.000Z';
    const stats = {
      mint: 'm',
      wallet: 'w',
      bought_token_raw: 1_000_000,
      sold_token_raw: 800_000,
      buy_sol: 1,
      sell_sol: 1.2,
      buy_usd: 100,
      sell_usd: 120,
      avg_buy_usd: 0.0001,
      avg_sell_usd: 0.00015,
      realized_pnl_usd: 20,
      unrealized_pnl_usd: 0,
      remaining_token_raw: 200_000,
      remaining_token_ui: 0.2,
      first_trade_at: '2026-06-07T12:05:00.000Z',
      last_trade_at: '2026-06-07T12:20:00.000Z',
      updated_at: new Date().toISOString(),
    };
    assert.equal(detectSniperFromStats(stats, launch), true);
  });
});
