import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  makeSandboxTxHash,
  isSandboxTxHash,
  simulateBuy,
  simulateSell,
} from '@/lib/sandbox/executor';
import type { SandboxPosition } from '@/lib/sandbox/types';

describe('sandbox tx hashes', () => {
  it('uses SANDBOX_<ts>_<rand> format', () => {
    const h = makeSandboxTxHash(1700000000000);
    assert.match(h, /^SANDBOX_1700000000000_[a-z0-9]{10}$/);
    assert.equal(isSandboxTxHash(h), true);
    assert.equal(isSandboxTxHash('5xReal...'), false);
  });
});

describe('sandbox executor is pure + offline', () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it('simulateBuy never calls fetch and returns a sandbox-routed confirmed tx', () => {
    let fetchCalls = 0;
    globalThis.fetch = (() => {
      fetchCalls += 1;
      throw new Error('sandbox executor must not perform network I/O');
    }) as unknown as typeof fetch;

    const res = simulateBuy({
      walletId: 'sbx-primary',
      mint: 'SBX1pump',
      symbol: 'PEEPEE',
      amountSol: 2,
      priceSol: 0.000002,
    });

    assert.equal(fetchCalls, 0);
    assert.equal(res.tx.route, 'sandbox');
    assert.equal(res.tx.status, 'confirmed');
    assert.ok(res.amountToken > 0);
    assert.ok(res.platformFeeSol > 0);
    assert.ok(res.tx.latencyMs >= 250 && res.tx.latencyMs < 1800);
    assert.ok(isSandboxTxHash(res.tx.hash));
  });

  it('simulateSell never calls fetch and computes realized PnL vs cost basis', () => {
    let fetchCalls = 0;
    globalThis.fetch = (() => {
      fetchCalls += 1;
      throw new Error('sandbox executor must not perform network I/O');
    }) as unknown as typeof fetch;

    const position: SandboxPosition = {
      mint: 'SBX1pump',
      symbol: 'PEEPEE',
      walletId: 'sbx-primary',
      amount: 1_000_000,
      avgPriceSol: 0.000001,
      costBasisSol: 1,
      updatedAt: Date.now(),
    };

    // Sell at 2x the average entry → realized PnL should be positive.
    const res = simulateSell({
      walletId: 'sbx-primary',
      mint: 'SBX1pump',
      symbol: 'PEEPEE',
      amountToken: 1_000_000,
      priceSol: 0.000002,
      position,
    });

    assert.equal(fetchCalls, 0);
    assert.equal(res.tx.route, 'sandbox');
    assert.equal(res.tx.kind, 'sell');
    assert.ok(res.proceedsSol > 0);
    assert.ok(res.realizedPnlSol > 0);
  });
});
