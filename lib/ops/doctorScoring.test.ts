import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { inferDomain, scoreFinding } from '@/lib/ops/doctorScoring';

describe('scoreFinding — confidence', () => {
  it('defaults by severity, clamps overrides', () => {
    assert.equal(scoreFinding({ severity: 'critical', domain: 'infra' }).confidence, 0.9);
    assert.equal(scoreFinding({ severity: 'warn', domain: 'infra' }).confidence, 0.6);
    assert.equal(scoreFinding({ severity: 'info', domain: 'infra' }).confidence, 0.3);
    assert.equal(scoreFinding({ severity: 'warn', domain: 'infra', confidence: 5 }).confidence, 1);
    assert.equal(scoreFinding({ severity: 'warn', domain: 'infra', confidence: -1 }).confidence, 0);
  });
});

describe('scoreFinding — impact', () => {
  it('money criticals carry HIGH revenue + user impact and critical urgency', () => {
    const s = scoreFinding({ severity: 'critical', domain: 'money' });
    assert.equal(s.revenueImpact, 'high');
    assert.equal(s.userImpact, 'high');
    assert.equal(s.urgency, 'critical');
  });
  it('infra warn → no revenue impact, high urgency', () => {
    const s = scoreFinding({ severity: 'warn', domain: 'infra' });
    assert.equal(s.revenueImpact, 'none');
    assert.equal(s.urgency, 'high');
  });
  it('ai critical → medium revenue impact', () => {
    assert.equal(scoreFinding({ severity: 'critical', domain: 'ai' }).revenueImpact, 'medium');
  });
  it('info findings are low/none + low urgency', () => {
    const s = scoreFinding({ severity: 'info', domain: 'other' });
    assert.equal(s.urgency, 'low');
    assert.equal(s.revenueImpact, 'none');
  });
});

describe('scoreFinding — priority ordering', () => {
  it('a money critical outranks an infra warn', () => {
    const money = scoreFinding({ severity: 'critical', domain: 'money' });
    const infra = scoreFinding({ severity: 'warn', domain: 'infra' });
    assert.ok(money.priority > infra.priority);
  });
  it('a low-confidence critical ranks below a high-confidence one', () => {
    const sure = scoreFinding({ severity: 'critical', domain: 'money', confidence: 0.95 });
    const unsure = scoreFinding({ severity: 'critical', domain: 'money', confidence: 0.3 });
    assert.ok(sure.priority > unsure.priority);
  });
});

describe('inferDomain', () => {
  it('maps finding ids to domains', () => {
    assert.equal(inferDomain('trade-fail-rate'), 'money');
    assert.equal(inferDomain('cashback-skip'), 'money');
    assert.equal(inferDomain('provider-unconfigured-helius'), 'infra');
    assert.equal(inferDomain('pulse-stale'), 'realtime');
    assert.equal(inferDomain('indexer-backlog'), 'data');
    assert.equal(inferDomain('copilot-model-error'), 'ai');
    assert.equal(inferDomain('ai-quota-breach'), 'money'); // quota = spend → money
    assert.equal(inferDomain('something-else'), 'other');
  });
});
