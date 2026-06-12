import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { balanceRawFromQueryData } from '@/lib/trading/tradeBalanceQuery';
import { computeDeskWalletDisplayStats } from '@/lib/trading/deskWalletDisplayStats';

describe('tradeBalanceQuery', () => {
  it('extracts rawAmount from cached balance object', () => {
    assert.equal(balanceRawFromQueryData({ rawAmount: '12345' }), '12345');
    assert.equal(balanceRawFromQueryData('999'), '999');
    assert.equal(balanceRawFromQueryData(null), '0');
  });
});

describe('deskWalletDisplayStats', () => {
  it('uses indexed desk stats over empty session', () => {
    const stats = computeDeskWalletDisplayStats({
      session: { buyTon: 0, sellTon: 0 },
      desk: {
        mint: 'm',
        wallet: 'w',
        bought_token_raw: 1000,
        sold_token_raw: 0,
        buy_sol: 0.021,
        sell_sol: 0,
        buy_usd: 2.1,
        sell_usd: 0,
        avg_buy_usd: 0.01,
        avg_sell_usd: null,
        realized_pnl_usd: 0,
        unrealized_pnl_usd: -1.4,
        remaining_token_raw: 1000,
        remaining_token_ui: 1,
        first_trade_at: null,
        last_trade_at: null,
        updated_at: new Date().toISOString(),
      },
      solUsdRate: 100,
      priceUsd: 0.027,
      balanceRaw: { rawAmount: '1000000' },
      decimals: 6,
    });
    assert.equal(stats.buyTon, 0.021);
    assert.equal(stats.buyUsd, 2.1);
    assert.ok(stats.holdingUsd > 0);
    assert.ok(stats.netPnlUsd < 0);
  });
});
