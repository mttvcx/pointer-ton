import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeWalletAddress,
  walletRegistryKey,
} from '@/lib/identity/normalize';
import { hydrateTradeEventsFromMintTrades } from '@/lib/identity/tradeEvents';

const SOL_WALLET = 'LcxeUtM2uaciTB1H778scjmk4Ho53kN6JQNZm9yXzFJ';
const MINT = 'GZQFCZjfzQyFSkA4jBuEeh5eKTLNzju7PZrEWxMvpump';

describe('normalizeWalletAddress', () => {
  it('returns invalid for undefined without throwing', () => {
    const r = normalizeWalletAddress('sol', undefined as unknown as string);
    assert.equal(r.valid, false);
    assert.equal(r.normalized, '');
  });

  it('returns invalid for null without throwing', () => {
    const r = normalizeWalletAddress('sol', null as unknown as string);
    assert.equal(r.valid, false);
    assert.equal(r.normalized, '');
  });

  it('returns invalid for empty string', () => {
    const r = normalizeWalletAddress('sol', '   ');
    assert.equal(r.valid, false);
    assert.equal(r.normalized, '');
  });

  it('normalizes valid Solana wallet', () => {
    const r = normalizeWalletAddress('sol', SOL_WALLET);
    assert.equal(r.valid, true);
    assert.equal(r.normalized, SOL_WALLET);
    assert.equal(r.addressType, 'solana');
  });
});

describe('walletRegistryKey', () => {
  it('does not throw for undefined address', () => {
    assert.doesNotThrow(() => walletRegistryKey('sol', undefined as unknown as string));
    assert.equal(walletRegistryKey('sol', undefined as unknown as string), 'sol:');
  });
});

describe('hydrateTradeEventsFromMintTrades', () => {
  it('skips rows without wallet and does not crash', () => {
    assert.doesNotThrow(() =>
      hydrateTradeEventsFromMintTrades('sol', MINT, [
        {
          wallet_address: undefined as unknown as string,
          side: 'buy',
          submitted_at: new Date().toISOString(),
        },
        {
          wallet_address: null as unknown as string,
          side: 'sell',
          submitted_at: new Date().toISOString(),
        },
      ]),
    );
    const out = hydrateTradeEventsFromMintTrades('sol', MINT, [
      {
        wallet_address: undefined as unknown as string,
        side: 'buy',
        submitted_at: new Date().toISOString(),
      },
    ]);
    assert.equal(out.length, 0);
  });
});
