import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  liquidityRiskTier,
  liquidityRiskValueClass,
  tapeConfidenceLabel,
} from '@/lib/tokens/tokenDeskRisk';

describe('tokenDeskRisk', () => {
  it('classifies liquidity tiers', () => {
    assert.equal(liquidityRiskTier(null), 'missing');
    assert.equal(liquidityRiskTier(100), 'critical');
    assert.equal(liquidityRiskTier(2_000), 'low');
    assert.equal(liquidityRiskTier(50_000), 'healthy');
  });

  it('colors liquidity risk', () => {
    assert.match(liquidityRiskValueClass(100), /signal-bear/);
    assert.match(liquidityRiskValueClass(2_000), /signal-warn/);
    assert.match(liquidityRiskValueClass(50_000), /fg-primary/);
  });

  it('labels tape confidence', () => {
    assert.equal(tapeConfidenceLabel(false, 0, '6h').label, 'Not indexed');
    assert.equal(tapeConfidenceLabel(true, 0, '5m').label, 'No swaps in 5m');
    assert.equal(tapeConfidenceLabel(true, 100, '6h').label, 'Indexed chain trades');
  });
});
