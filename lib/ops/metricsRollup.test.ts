import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { percentile, rollupSamples, successRate } from '@/lib/ops/metricsRollup';

describe('percentile', () => {
  it('handles empty + single', () => {
    assert.equal(percentile([], 0.5), 0);
    assert.equal(percentile([42], 0.95), 42);
  });
  it('p50 / p95 over a known series', () => {
    const v = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    assert.equal(percentile(v, 0.5), 5.5);
    assert.ok(Math.abs(percentile(v, 0.95) - 9.55) < 0.001);
    assert.equal(percentile(v, 1), 10);
    assert.equal(percentile(v, 0), 1);
  });
  it('is order-independent (sorts internally)', () => {
    assert.equal(percentile([10, 1, 5, 3], 0.5), percentile([1, 3, 5, 10], 0.5));
  });
});

describe('rollupSamples', () => {
  it('empty → zeros + null latest', () => {
    const r = rollupSamples([]);
    assert.equal(r.count, 0);
    assert.equal(r.latest, null);
  });
  it('summary stats + latest is the last sample', () => {
    const r = rollupSamples([10, 20, 30, 40]); // chronological
    assert.equal(r.count, 4);
    assert.equal(r.sum, 100);
    assert.equal(r.avg, 25);
    assert.equal(r.min, 10);
    assert.equal(r.max, 40);
    assert.equal(r.latest, 40);
  });
  it('drops non-finite samples', () => {
    const r = rollupSamples([1, NaN, 3, Infinity]);
    assert.equal(r.count, 2);
    assert.equal(r.sum, 4);
  });
});

describe('successRate', () => {
  it('100% when nothing happened', () => assert.equal(successRate(0, 0), 100));
  it('rounds to one decimal', () => {
    assert.equal(successRate(995, 1000), 99.5);
    assert.equal(successRate(1, 3), 33.3);
  });
  it('full + zero', () => {
    assert.equal(successRate(10, 10), 100);
    assert.equal(successRate(0, 10), 0);
  });
});
