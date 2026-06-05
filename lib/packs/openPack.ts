import { randomUUID } from 'crypto';
import type {
  PackConfig,
  PackOpenResult,
  PackOutcomeSlot,
  PackReward,
  RewardRarity,
} from '@/types/pack';
import { isJackpotPull } from '@/lib/packs/pullIntensity';
import { pickPackToken } from '@/lib/packs/packTokens';

const RARITY_RANK: Record<RewardRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
};

function rollBps(rng: () => number): number {
  return Math.floor(rng() * 10_000);
}

function rollRange(min: number, max: number, rng: () => number): number {
  return min + rng() * (max - min);
}

function pickOutcome(outcomes: PackOutcomeSlot[], roll: number): PackOutcomeSlot {
  let cum = 0;
  for (const o of outcomes) {
    cum += o.probabilityBps;
    if (roll < cum) return o;
  }
  return outcomes[outcomes.length - 1]!;
}

function findJackpotSlot(config: PackConfig): PackOutcomeSlot | null {
  return (
    config.outcomes.find((o) => o.kind === 'legendary_reward' && o.rarity === 'mythic') ?? null
  );
}

function buildReward(slot: PackOutcomeSlot, rng: () => number): PackReward {
  if (slot.kind === 'token_reward' || slot.kind === 'legendary_reward') {
    const token = pickPackToken(slot.rarity, rng);
    const lo = slot.minValueSol ?? 0;
    const hi = slot.maxValueSol ?? lo;
    const valueSol = rollRange(lo, hi, rng);
    return {
      id: randomUUID(),
      rarity: slot.rarity,
      kind: slot.kind,
      title: token.name,
      subtitle: token.symbol,
      displayValue: `${valueSol.toFixed(valueSol >= 10 ? 1 : 2)} SOL`,
      valueSol,
      valueUsd: null,
      multiplier: null,
      badgeLabel: null,
      tokenId: token.id,
      tokenMint: token.mint,
      tokenSymbol: token.symbol,
      tokenName: token.name,
      tokenIconUrl: token.iconUrl,
      tokenPriceUsd: token.fallbackPriceUsd,
      marketCapUsd: token.fallbackMarketCapUsd,
      amountTokens: null,
    };
  }

  if (slot.kind === 'cashback_multiplier' || slot.kind === 'points_multiplier') {
    const m = slot.multiplier ?? 1.25;
    const pct = Math.round((m - 1) * 100);
    const label = slot.kind === 'cashback_multiplier' ? 'Cashback boost' : 'Points boost';
    return {
      id: randomUUID(),
      rarity: slot.rarity,
      kind: slot.kind,
      title: slot.title ?? label,
      subtitle: slot.kind === 'cashback_multiplier' ? 'Fee rebate window' : 'Earn multiplier',
      displayValue: `+${pct}%`,
      valueSol: null,
      valueUsd: null,
      multiplier: m,
      badgeLabel: null,
    };
  }

  return {
    id: randomUUID(),
    rarity: slot.rarity,
    kind: slot.kind,
    title: slot.title ?? 'Alpha Pass',
    subtitle: 'Trader access',
    displayValue: slot.badgeLabel ?? 'Access',
    valueSol: null,
    valueUsd: null,
    multiplier: null,
    badgeLabel: slot.badgeLabel ?? 'Alpha pass',
  };
}

function finalizeOpen(
  config: PackConfig,
  rewards: PackReward[],
  meta?: {
    solUsd?: number;
    approximateUsd?: number;
    solUsdSource?: 'live' | 'fallback';
    modeledHouseEdgeBps?: number;
    fullOpenEvSol?: number;
  },
): PackOpenResult {
  rewards.sort((a, b) => RARITY_RANK[b.rarity] - RARITY_RANK[a.rarity]);
  const totalTokenValueSol = rewards.reduce((s, r) => s + (r.valueSol ?? 0), 0);
  const highlightRarity = rewards[0]?.rarity ?? 'common';
  const base = {
    openId: randomUUID(),
    packType: config.type,
    packLabel: config.label,
    priceSol: config.packPriceSol,
    openedAt: new Date().toISOString(),
    rewards,
    totalTokenValueSol,
    highlightRarity,
    solUsd: meta?.solUsd,
    approximateUsd: meta?.approximateUsd,
    solUsdSource: meta?.solUsdSource,
    modeledHouseEdgeBps: meta?.modeledHouseEdgeBps,
    fullOpenEvSol: meta?.fullOpenEvSol,
  };
  return { ...base, isJackpotPull: isJackpotPull(base) };
}

/** Force the legendary 0.01% mythic jackpot for UI testing. */
export function openPackJackpotTest(config: PackConfig): PackOpenResult {
  const slot = findJackpotSlot(config);
  if (!slot) {
    throw new Error('jackpot_slot_missing');
  }
  return buildCelebrationTestPack(config, slot);
}

function findSlotForCelebrationTest(
  config: PackConfig,
  mode: 'legendary_elite' | 'epic_surge',
): PackOutcomeSlot {
  if (mode === 'legendary_elite') {
    const slot =
      config.outcomes.find((o) => o.rarity === 'legendary' && o.kind === 'legendary_reward') ??
      config.outcomes.find((o) => o.rarity === 'legendary' && o.kind === 'token_reward') ??
      config.outcomes.find((o) => o.rarity === 'legendary');
    if (!slot) throw new Error('legendary_slot_missing');
    return slot;
  }
  const slot = config.outcomes.find((o) => o.rarity === 'epic');
  if (!slot) throw new Error('epic_slot_missing');
  return slot;
}

function buildCelebrationTestPack(config: PackConfig, heroSlot: PackOutcomeSlot): PackOpenResult {
  const hero = buildReward(heroSlot, () => 0.92);
  const fillerSlots = config.outcomes.filter(
    (o) => !(o.rarity === heroSlot.rarity && o.kind === heroSlot.kind && o.title === heroSlot.title),
  );
  const rewards: PackReward[] = [hero];
  for (let i = 1; i < config.cardsPerOpen; i++) {
    const roll = rollBps(Math.random);
    rewards.push(buildReward(pickOutcome(fillerSlots, roll), Math.random));
  }
  return finalizeOpen(config, rewards);
}

/** Dev — legendary vault-open celebration. */
export function openPackLegendaryEliteTest(config: PackConfig): PackOpenResult {
  return buildCelebrationTestPack(config, findSlotForCelebrationTest(config, 'legendary_elite'));
}

/** Dev — epic candle-surge celebration. */
export function openPackEpicSurgeTest(config: PackConfig): PackOpenResult {
  return buildCelebrationTestPack(config, findSlotForCelebrationTest(config, 'epic_surge'));
}

/** Server-side pack roll. TODO(fairness): commit-reveal / VRF. */
export function openPackServer(
  config: PackConfig,
  rng: () => number = Math.random,
  openMeta?: Parameters<typeof finalizeOpen>[2],
): PackOpenResult {
  const rewards: PackReward[] = [];

  for (let i = 0; i < config.cardsPerOpen; i++) {
    const roll = rollBps(rng);
    const slot = pickOutcome(config.outcomes, roll);
    rewards.push(buildReward(slot, rng));
  }

  return finalizeOpen(config, rewards, openMeta);
}
