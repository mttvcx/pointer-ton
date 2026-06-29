import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  decideBreakerState,
  PROVIDER_NAMES,
  stateAllows,
  type ProviderBudget,
} from '@/lib/providers/breakerDecisions';

const B: ProviderBudget = { daily: 1000, monthly: 20000, warnPct: 80 };

describe('providers: decideBreakerState', () => {
  it('ok well under budget', () => {
    assert.equal(decideBreakerState(10, 100, B), 'ok');
  });

  it('warn at >= warnPct of the daily window', () => {
    assert.equal(decideBreakerState(800, 100, B), 'warn'); // 80% daily
    assert.equal(decideBreakerState(799, 100, B), 'ok'); // 79.9% daily
  });

  it('warn at >= warnPct of the monthly window', () => {
    assert.equal(decideBreakerState(10, 16000, B), 'warn'); // 80% monthly
  });

  it('tripped (hard cutoff) when over the daily budget', () => {
    assert.equal(decideBreakerState(1001, 100, B), 'tripped');
  });

  it('tripped when over the monthly budget even if daily is fine', () => {
    assert.equal(decideBreakerState(10, 20001, B), 'tripped');
  });

  it('exactly at budget is allowed (strict >)', () => {
    assert.equal(decideBreakerState(1000, 20000, B), 'warn'); // at cap → warn, not tripped
  });

  it('a 0 budget means unlimited for that window', () => {
    const monthlyOnly: ProviderBudget = { daily: 0, monthly: 950, warnPct: 80 };
    assert.equal(decideBreakerState(9_999_999, 10, monthlyOnly), 'ok'); // daily uncapped
    assert.equal(decideBreakerState(9_999_999, 951, monthlyOnly), 'tripped'); // monthly trips
  });
});

describe('providers: stateAllows', () => {
  it('ok and warn permit the call; tripped and disabled block it', () => {
    assert.equal(stateAllows('ok'), true);
    assert.equal(stateAllows('warn'), true);
    assert.equal(stateAllows('tripped'), false);
    assert.equal(stateAllows('disabled'), false);
  });
});

describe('providers: registry', () => {
  it('covers exactly the five protected upstreams', () => {
    assert.deepEqual([...PROVIDER_NAMES].sort(), ['dexscreener', 'helius', 'insightx', 'jupiter', 'moralis']);
  });
});
