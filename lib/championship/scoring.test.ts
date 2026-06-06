import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  drawdownMultiplier,
  pnlPoints,
  profitEventPoints,
  qualifiesForPrizes,
  roiMultiplier,
  scoreParticipant,
  volumePoints,
} from '@/lib/championship/scoring';
import { placementPointsForRank, SOLO_PLACEMENT_POINTS } from '@/lib/championship/config';
import type { ChampionshipScoreInput } from '@/lib/championship/types';

/** Minimal clean participant — no abuse flags, eligible. */
function baseInput(overrides: Partial<ChampionshipScoreInput> = {}): ChampionshipScoreInput {
  return {
    realizedPnlUsd: 0,
    eventVolumeUsd: 1000,
    closedTrades: 10,
    profitableClosedTrades: 5,
    uniqueTokensTraded: 8,
    biggestWinRoiPct: 0,
    roiPct: 0,
    maxDrawdownPct: 0,
    suspiciousFlags: [],
    reviewStatus: 'eligible',
    closedTradeRoisPct: [],
    ...overrides,
  };
}

describe('PTCS — PnL points', () => {
  it('is 1 point per $10 realized, floored', () => {
    assert.equal(pnlPoints(0), 0);
    assert.equal(pnlPoints(9.99), 0);
    assert.equal(pnlPoints(10), 1);
    assert.equal(pnlPoints(1234), 123);
  });

  it('never awards points for losses', () => {
    assert.equal(pnlPoints(-1), 0);
    assert.equal(pnlPoints(-100000), 0);
  });
});

describe('PTCS — ROI multiplier', () => {
  it('penalizes negative ROI and scales up with performance', () => {
    assert.equal(roiMultiplier(-5), 0.25);
    assert.equal(roiMultiplier(0), 1);
    assert.equal(roiMultiplier(9.99), 1);
    assert.equal(roiMultiplier(10), 1.15);
    assert.equal(roiMultiplier(24.99), 1.15);
    assert.equal(roiMultiplier(25), 1.3);
    assert.equal(roiMultiplier(50), 1.5);
    assert.equal(roiMultiplier(100), 1.75);
    assert.equal(roiMultiplier(100000), 1.75);
  });
});

describe('PTCS — volume + profit-event points', () => {
  it('volume is 1 point per $1000, floored, never negative', () => {
    assert.equal(volumePoints(0), 0);
    assert.equal(volumePoints(999), 0);
    assert.equal(volumePoints(1000), 1);
    assert.equal(volumePoints(25_500), 25);
    assert.equal(volumePoints(-1), 0);
  });

  it('profit events stack tiered bonuses for big winners', () => {
    assert.equal(profitEventPoints([]), 0);
    assert.equal(profitEventPoints([-10, 0]), 0);
    // small win: +2
    assert.equal(profitEventPoints([10]), 2);
    // >50%: +2 +10
    assert.equal(profitEventPoints([60]), 12);
    // >100%: +2 +10 +20
    assert.equal(profitEventPoints([150]), 32);
    // >500%: +2 +10 +20 +50
    assert.equal(profitEventPoints([600]), 82);
    // >1000%: +2 +10 +20 +50 +100
    assert.equal(profitEventPoints([2000]), 182);
  });
});

describe('PTCS — drawdown penalty', () => {
  it('cuts score for deep drawdowns', () => {
    assert.equal(drawdownMultiplier(0), 1);
    assert.equal(drawdownMultiplier(50), 1);
    assert.equal(drawdownMultiplier(50.01), 0.75);
    assert.equal(drawdownMultiplier(75), 0.75);
    assert.equal(drawdownMultiplier(75.01), 0.5);
  });
});

describe('PTCS — placement points', () => {
  it('maps rank into the configured solo table', () => {
    assert.equal(placementPointsForRank(1, SOLO_PLACEMENT_POINTS), 100);
    assert.equal(placementPointsForRank(2, SOLO_PLACEMENT_POINTS), 75);
    assert.equal(placementPointsForRank(3, SOLO_PLACEMENT_POINTS), 60);
    assert.equal(placementPointsForRank(10, SOLO_PLACEMENT_POINTS), 40);
    assert.equal(placementPointsForRank(25, SOLO_PLACEMENT_POINTS), 25);
    assert.equal(placementPointsForRank(50, SOLO_PLACEMENT_POINTS), 10);
    assert.equal(placementPointsForRank(51, SOLO_PLACEMENT_POINTS), 0);
    assert.equal(placementPointsForRank(0, SOLO_PLACEMENT_POINTS), 0);
  });
});

describe('PTCS — scoreParticipant composition', () => {
  it('combines (pnl + profit) * roiMult + volume, then placement, then drawdown', () => {
    const input = baseInput({
      realizedPnlUsd: 100, // 10 pnl pts
      roiPct: 30, // 1.3x
      eventVolumeUsd: 5000, // 5 vol pts
      closedTradeRoisPct: [60], // 12 profit pts
      maxDrawdownPct: 0,
    });
    const breakdown = scoreParticipant(input, 40);
    assert.equal(breakdown.pnlPoints, 10);
    assert.equal(breakdown.profitEventPoints, 12);
    assert.equal(breakdown.roiMultiplier, 1.3);
    assert.equal(breakdown.volumePoints, 5);
    // pre = (10 + 12) * 1.3 + 5 = 33.6 (preScore is unrounded -> compare with tolerance)
    assert.ok(Math.abs(breakdown.preScore - 33.6) < 1e-9);
    // final = (33.6 + 40) * 1 = 73.6 (finalScore is rounded to 2dp)
    assert.equal(breakdown.finalScore, 73.6);
  });

  it('applies drawdown multiplier to the placement-inclusive score', () => {
    const input = baseInput({
      realizedPnlUsd: 100,
      roiPct: 0,
      eventVolumeUsd: 0, // no volume points
      maxDrawdownPct: 80, // 0.5x
    });
    const breakdown = scoreParticipant(input, 0);
    // pre = (10 + 0) * 1 + 0 = 10; final = 10 * 0.5 = 5
    assert.equal(breakdown.finalScore, 5);
  });

  it('zeros the score when disqualified', () => {
    const input = baseInput({ realizedPnlUsd: 1000, reviewStatus: 'disqualified' });
    const breakdown = scoreParticipant(input, 100);
    assert.equal(breakdown.finalScore, 0);
  });
});

describe('PTCS — prize qualification', () => {
  it('requires non-negative PnL and an eligible-ish review status', () => {
    assert.equal(qualifiesForPrizes('eligible', 100), true);
    assert.equal(qualifiesForPrizes('finalized', 0), true);
    assert.equal(qualifiesForPrizes('low_sample', 5), true);
    assert.equal(qualifiesForPrizes('eligible', -1), false);
    assert.equal(qualifiesForPrizes('disqualified', 100), false);
  });
});
