import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { buildRewardFulfillmentPlan } from '@/lib/packs/rewardFulfillmentPlan';
import { evaluatePaymentDelta } from '@/lib/packs/paymentMath';
import { PACK_ITEM_SELL_FEE_BPS } from '@/lib/packs/constants';
import type { PackReward, RewardKind, RewardRarity } from '@/types/pack';

function tokenReward(over: Partial<PackReward> = {}): PackReward {
  return {
    id: over.id ?? 'r1',
    rarity: (over.rarity ?? 'rare') as RewardRarity,
    kind: (over.kind ?? 'token_reward') as RewardKind,
    title: 'T',
    subtitle: 's',
    displayValue: '1 SOL',
    valueSol: over.valueSol ?? 0.1,
    valueUsd: null,
    multiplier: null,
    badgeLabel: null,
    tokenMint: over.tokenMint ?? 'MintAaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    tokenSymbol: over.tokenSymbol ?? 'TKN',
    ...over,
  };
}

describe('buildRewardFulfillmentPlan', () => {
  it('creates one buy intent per token reward with correct lamports', () => {
    const plan = buildRewardFulfillmentPlan(
      { rewards: [tokenReward({ id: 'a', valueSol: 0.25 })] },
      { maxPayoutSol: 10 },
    );
    assert.equal(plan.intents.length, 1);
    assert.equal(plan.intents[0]!.lamportsToSpend, 250_000_000); // 0.25 SOL
    assert.equal(plan.totalSpendSol, 0.25);
    assert.equal(plan.skipped.length, 0);
  });

  it('skips non-token rewards (multipliers / badges)', () => {
    const reward: PackReward = {
      id: 'm',
      rarity: 'uncommon',
      kind: 'cashback_multiplier',
      title: 'Boost',
      subtitle: 'x',
      displayValue: '+25%',
      valueSol: null,
      valueUsd: null,
      multiplier: 1.25,
      badgeLabel: null,
    };
    const plan = buildRewardFulfillmentPlan({ rewards: [reward] }, { maxPayoutSol: 10 });
    assert.equal(plan.intents.length, 0);
    assert.equal(plan.skipped[0]!.reason, 'non_token_reward');
  });

  it('skips token rewards with no mint or no value', () => {
    const plan = buildRewardFulfillmentPlan(
      {
        rewards: [
          tokenReward({ id: 'nomint', tokenMint: null }),
          tokenReward({ id: 'noval', valueSol: 0 }),
        ],
      },
      { maxPayoutSol: 10 },
    );
    assert.equal(plan.intents.length, 0);
    assert.deepEqual(
      plan.skipped.map((s) => s.reason),
      ['missing_mint_or_value', 'missing_mint_or_value'],
    );
  });

  it('caps cumulative spend at maxPayoutSol (anti-drain guard)', () => {
    const plan = buildRewardFulfillmentPlan(
      {
        rewards: [
          tokenReward({ id: 'a', valueSol: 0.6 }),
          tokenReward({ id: 'b', valueSol: 0.6 }),
        ],
      },
      { maxPayoutSol: 1 },
    );
    assert.equal(plan.intents.length, 1);
    assert.equal(plan.skipped[0]!.reason, 'exceeds_max_payout_cap');
    assert.ok(plan.totalSpendSol <= 1);
  });
});

describe('evaluatePaymentDelta', () => {
  it('accepts exact and over-payment', () => {
    assert.equal(evaluatePaymentDelta(1_000_000_000, 1_000_000_000).ok, true);
    assert.equal(evaluatePaymentDelta(1_100_000_000, 1_000_000_000).ok, true);
  });

  it('allows small downward drift within tolerance (default 2%)', () => {
    // 1% under expected -> within 2% tolerance
    assert.equal(evaluatePaymentDelta(990_000_000, 1_000_000_000).ok, true);
  });

  it('rejects payment below tolerance floor', () => {
    const v = evaluatePaymentDelta(900_000_000, 1_000_000_000); // 10% under
    assert.equal(v.ok, false);
    assert.equal((v as { reason: string }).reason, 'insufficient_payment');
  });

  it('rejects a non-positive expected amount', () => {
    assert.equal(evaluatePaymentDelta(100, 0).ok, false);
  });
});

describe('pack item sell fee constant', () => {
  it('is 2% (200 bps)', () => {
    assert.equal(PACK_ITEM_SELL_FEE_BPS, 200);
  });
});
