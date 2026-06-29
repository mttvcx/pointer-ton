import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { aiAccessHeadline, decideAiAccess, DEFAULT_AI_ACCESS_MIN_SOL } from '@/lib/access/aiAccessDecision';

describe('decideAiAccess — subscription', () => {
  it('an active subscription unlocks regardless of holdings', () => {
    const d = decideAiAccess({ hasActiveSubscription: true, holdingsSol: 0 });
    assert.equal(d.allowed, true);
    assert.equal(d.basis, 'subscription');
  });
  it('subscription wins even when holdings are unverifiable', () => {
    const d = decideAiAccess({ hasActiveSubscription: true, holdingsSol: null });
    assert.equal(d.allowed, true);
    assert.equal(d.basis, 'subscription');
  });
});

describe('decideAiAccess — holdings', () => {
  it('grants at/above the threshold', () => {
    assert.equal(decideAiAccess({ hasActiveSubscription: false, holdingsSol: 5 }).allowed, true);
    assert.equal(decideAiAccess({ hasActiveSubscription: false, holdingsSol: 12.3 }).basis, 'holdings');
  });
  it('denies a CONFIRMED below-threshold balance', () => {
    const d = decideAiAccess({ hasActiveSubscription: false, holdingsSol: 4.99 });
    assert.equal(d.allowed, false);
    assert.equal(d.basis, 'none');
    assert.match(d.reason, /4\.99 SOL/);
  });
  it('respects a custom threshold', () => {
    assert.equal(decideAiAccess({ hasActiveSubscription: false, holdingsSol: 5, thresholdSol: 10 }).allowed, false);
    assert.equal(decideAiAccess({ hasActiveSubscription: false, holdingsSol: 10, thresholdSol: 10 }).allowed, true);
  });
  it('default threshold is 5 SOL', () => {
    assert.equal(DEFAULT_AI_ACCESS_MIN_SOL, 5);
    assert.equal(decideAiAccess({ hasActiveSubscription: false, holdingsSol: 4.999 }).allowed, false);
  });
});

describe('decideAiAccess — fail-open grace (never wrongly revoke)', () => {
  it('keeps access when holdings are unverifiable AND within grace', () => {
    const d = decideAiAccess({ hasActiveSubscription: false, holdingsSol: null, withinGrace: true });
    assert.equal(d.allowed, true);
    assert.equal(d.basis, 'grace');
  });
  it('denies when unverifiable and NOT within grace (no security hole)', () => {
    const d = decideAiAccess({ hasActiveSubscription: false, holdingsSol: null, withinGrace: false });
    assert.equal(d.allowed, false);
    assert.equal(d.basis, 'none');
  });
  it('a verified below-threshold is NOT rescued by grace', () => {
    // holdings were READ (4 SOL) → deny even if a stale grant existed.
    const d = decideAiAccess({ hasActiveSubscription: false, holdingsSol: 4, withinGrace: true });
    assert.equal(d.allowed, false);
  });
});

describe('aiAccessHeadline', () => {
  it('summarizes each basis', () => {
    assert.match(aiAccessHeadline(decideAiAccess({ hasActiveSubscription: true, holdingsSol: 0 })), /subscription/i);
    assert.match(aiAccessHeadline(decideAiAccess({ hasActiveSubscription: false, holdingsSol: 7 })), /7\.00 SOL/);
    assert.match(aiAccessHeadline(decideAiAccess({ hasActiveSubscription: false, holdingsSol: null })), /locked/i);
  });
});
