import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildTokenDeskSharePayload,
  hasTokenDeskShareActivity,
} from '@/lib/trading/buildTokenDeskSharePayload';
import type { DeskWalletDisplayStats } from '@/lib/trading/deskWalletDisplayStats';

const emptyStats: DeskWalletDisplayStats = {
  buyTon: 0,
  sellTon: 0,
  holdingSol: 0,
  holdingTokenUi: 0,
  netPnlSol: 0,
  netPnlPct: null,
  buyUsd: 0,
  sellUsd: 0,
  holdingUsd: 0,
  netPnlUsd: 0,
};

test('hasTokenDeskShareActivity when user bought or sold', () => {
  assert.equal(hasTokenDeskShareActivity(emptyStats), false);
  assert.equal(hasTokenDeskShareActivity({ ...emptyStats, buyTon: 0.01 }), true);
  assert.equal(hasTokenDeskShareActivity({ ...emptyStats, sellTon: 0.005 }), true);
});

test('buildTokenDeskSharePayload maps desk stats', () => {
  const stats: DeskWalletDisplayStats = {
    ...emptyStats,
    buyTon: 0.1,
    buyUsd: 12,
    holdingUsd: 8,
    netPnlUsd: -4,
    netPnlPct: -33.3,
  };
  const p = buildTokenDeskSharePayload({
    walletAddress: 'abc123',
    mint: 'mint1',
    tokenTicker: 'ISLANDS',
    tokenName: 'Islands',
    chain: 'sol',
    stats,
  });
  assert.equal(p.tokenTicker, 'ISLANDS');
  assert.equal(p.investedUsd, 12);
  assert.equal(p.positionUsd, 8);
  assert.equal(p.pnlUsd, -4);
  assert.equal(p.statInvestedLabel, 'Invested');
});
