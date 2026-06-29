import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  cacheHitRate,
  costPerUser,
  daysInMonth,
  projectMonthlySpend,
  savedByCache,
} from '@/lib/ai/costCenter';

describe('cacheHitRate', () => {
  it('0 when nothing happened', () => assert.equal(cacheHitRate(0, 0), 0));
  it('rounds to one decimal', () => {
    assert.equal(cacheHitRate(1, 1), 50);
    assert.equal(cacheHitRate(2, 1), 66.7);
    assert.equal(cacheHitRate(999, 1), 99.9);
  });
});

describe('projectMonthlySpend', () => {
  it('linear projection from elapsed days', () => {
    assert.equal(projectMonthlySpend(100, 10, 30), 300); // $10/day × 30
    assert.equal(projectMonthlySpend(50, 5, 31), 310);
  });
  it('day 0 / bad input → just the spend so far', () => {
    assert.equal(projectMonthlySpend(42, 0, 30), 42);
  });
});

describe('costPerUser', () => {
  it('spend ÷ users (4dp); 0 with no users', () => {
    assert.equal(costPerUser(10, 4), 2.5);
    assert.equal(costPerUser(1, 3), 0.3333);
    assert.equal(costPerUser(5, 0), 0);
  });
});

describe('savedByCache', () => {
  it('hits × avg miss cost', () => {
    assert.equal(savedByCache(100, 0.02), 2);
    assert.equal(savedByCache(0, 0.02), 0);
    assert.equal(savedByCache(100, 0), 0);
  });
});

describe('daysInMonth', () => {
  it('handles 30/31/feb', () => {
    assert.equal(daysInMonth(2026, 1), 31);
    assert.equal(daysInMonth(2026, 4), 30);
    assert.equal(daysInMonth(2024, 2), 29); // leap
    assert.equal(daysInMonth(2026, 2), 28);
  });
});
