import type { PackConfig, PackOutcomeSlot, PackType } from '@/types/pack';
import { MODELED_HOUSE_EDGE_MIN_BPS } from '@/lib/packs/packEconomics';
import { computePackEconomics } from '@/lib/packs/packEconomics';

export type PackOutcomeTemplate = Omit<
  PackOutcomeSlot,
  'minValueSol' | 'maxValueSol' | 'estimatedCostSol'
>;

export type PackTemplate = {
  type: PackType;
  label: string;
  tagline: string;
  cardsPerOpen: number;
  jackpotBudgetBps: number;
  /** Max single-card token return as % of pack (non-jackpot cap). */
  maxNormalReturnPctOfPack: number;
  /** Max mythic payout as % of pack. */
  maxJackpotReturnPctOfPack: number;
  rewardPoolBudgetMultiplier: number;
  outcomes: PackOutcomeTemplate[];
};

function pctSol(packPriceSol: number, pct: number): number {
  return packPriceSol * pct;
}

function materializeOutcome(slot: PackOutcomeTemplate, packPriceSol: number): PackOutcomeSlot {
  const base: PackOutcomeSlot = { ...slot };

  if (slot.kind === 'token_reward' || slot.kind === 'legendary_reward') {
    const minPct = slot.minReturnPctOfPack ?? 0;
    const maxPct = slot.maxReturnPctOfPack ?? minPct;
    base.minValueSol = pctSol(packPriceSol, minPct);
    base.maxValueSol = pctSol(packPriceSol, maxPct);
  }

  if (slot.estimatedCostPctOfPack != null) {
    base.estimatedCostSol = packPriceSol * slot.estimatedCostPctOfPack;
  }

  return base;
}

function sumBpsFor(
  outcomes: PackOutcomeTemplate[],
  pred: (o: PackOutcomeTemplate) => boolean,
): number {
  return outcomes.filter(pred).reduce((s, o) => s + o.probabilityBps, 0);
}

export function buildPackConfigFromTemplate(
  template: PackTemplate,
  packPriceSol: number,
): PackConfig {
  const outcomes = template.outcomes.map((o) => materializeOutcome(o, packPriceSol));
  const rareChanceBps = sumBpsFor(
    template.outcomes,
    (o) => o.rarity === 'rare' || o.rarity === 'epic',
  );
  const legendaryChanceBps = sumBpsFor(
    template.outcomes,
    (o) => o.rarity === 'legendary' || o.rarity === 'mythic',
  );
  const jackpotChanceBps = sumBpsFor(
    template.outcomes,
    (o) => o.rarity === 'mythic' && o.kind === 'legendary_reward',
  );

  const tokenMins = outcomes
    .filter((o) => o.kind === 'token_reward' || o.kind === 'legendary_reward')
    .map((o) => o.minValueSol ?? 0);
  const tokenMaxNormals = outcomes
    .filter(
      (o) =>
        (o.kind === 'token_reward' || o.kind === 'legendary_reward') && o.rarity !== 'mythic',
    )
    .map((o) => o.maxValueSol ?? 0);

  const maxPayoutSol = pctSol(packPriceSol, template.maxJackpotReturnPctOfPack);

  return {
    type: template.type,
    label: template.label,
    tagline: template.tagline,
    packPriceSol,
    targetHouseMarginBps: MODELED_HOUSE_EDGE_MIN_BPS,
    minReturnSol: tokenMins.length ? Math.min(...tokenMins) : pctSol(packPriceSol, 0.02),
    maxNormalReturnSol: tokenMaxNormals.length
      ? Math.max(...tokenMaxNormals)
      : pctSol(packPriceSol, template.maxNormalReturnPctOfPack),
    rareChanceBps,
    legendaryChanceBps,
    jackpotChanceBps,
    maxPayoutSol,
    rewardPoolBudgetSol: packPriceSol * template.rewardPoolBudgetMultiplier,
    jackpotBudgetBps: template.jackpotBudgetBps,
    enabled: true,
    outcomes,
    cardsPerOpen: template.cardsPerOpen,
  };
}

function bronzeTemplate(): PackTemplate {
  return {
    type: 'bronze',
    label: 'Bronze',
    tagline: 'Entry clip — scout wallets & micro runners',
    cardsPerOpen: 3,
    jackpotBudgetBps: 120,
    maxNormalReturnPctOfPack: 0.22,
    maxJackpotReturnPctOfPack: 1.2,
    rewardPoolBudgetMultiplier: 120,
    outcomes: [
      {
        rarity: 'common',
        kind: 'token_reward',
        probabilityBps: 5770,
        minReturnPctOfPack: 0.08,
        maxReturnPctOfPack: 0.14,
        title: 'Scout pull',
      },
      {
        rarity: 'uncommon',
        kind: 'token_reward',
        probabilityBps: 2400,
        minReturnPctOfPack: 0.12,
        maxReturnPctOfPack: 0.18,
        title: 'Momentum clip',
      },
      {
        rarity: 'uncommon',
        kind: 'points_multiplier',
        probabilityBps: 700,
        multiplier: 1.15,
        estimatedCostPctOfPack: 0.006,
        title: 'Points surge',
      },
      {
        rarity: 'rare',
        kind: 'token_reward',
        probabilityBps: 900,
        minReturnPctOfPack: 0.16,
        maxReturnPctOfPack: 0.22,
        title: 'Alpha ticket',
      },
      {
        rarity: 'epic',
        kind: 'cashback_multiplier',
        probabilityBps: 180,
        multiplier: 1.2,
        estimatedCostPctOfPack: 0.012,
        title: 'Cashback boost',
      },
      {
        rarity: 'legendary',
        kind: 'rare_access_badge',
        probabilityBps: 40,
        badgeLabel: 'Bronze insider',
        estimatedCostPctOfPack: 0.004,
        title: 'Insider badge',
      },
      {
        rarity: 'mythic',
        kind: 'legendary_reward',
        probabilityBps: 10,
        minReturnPctOfPack: 0.55,
        maxReturnPctOfPack: 1.0,
        title: 'Jackpot clip',
      },
    ],
  };
}

function silverTemplate(): PackTemplate {
  return {
    type: 'silver',
    label: 'Silver',
    tagline: 'Rotation pack — desk favorites & fee boosts',
    cardsPerOpen: 4,
    jackpotBudgetBps: 150,
    maxNormalReturnPctOfPack: 0.28,
    maxJackpotReturnPctOfPack: 1.5,
    rewardPoolBudgetMultiplier: 100,
    outcomes: [
      {
        rarity: 'common',
        kind: 'token_reward',
        probabilityBps: 5350,
        minReturnPctOfPack: 0.1,
        maxReturnPctOfPack: 0.16,
        title: 'Core rotation',
      },
      {
        rarity: 'uncommon',
        kind: 'token_reward',
        probabilityBps: 2500,
        minReturnPctOfPack: 0.14,
        maxReturnPctOfPack: 0.2,
        title: 'Desk favorite',
      },
      {
        rarity: 'uncommon',
        kind: 'points_multiplier',
        probabilityBps: 900,
        multiplier: 1.25,
        estimatedCostPctOfPack: 0.008,
        title: 'Points burst',
      },
      {
        rarity: 'rare',
        kind: 'token_reward',
        probabilityBps: 900,
        minReturnPctOfPack: 0.18,
        maxReturnPctOfPack: 0.26,
        title: 'Smart money hit',
      },
      {
        rarity: 'epic',
        kind: 'cashback_multiplier',
        probabilityBps: 220,
        multiplier: 1.35,
        estimatedCostPctOfPack: 0.018,
        title: 'Fee rebate',
      },
      {
        rarity: 'legendary',
        kind: 'rare_access_badge',
        probabilityBps: 100,
        badgeLabel: 'Silver syndicate',
        estimatedCostPctOfPack: 0.005,
        title: 'Syndicate pass',
      },
      {
        rarity: 'mythic',
        kind: 'legendary_reward',
        probabilityBps: 30,
        minReturnPctOfPack: 0.65,
        maxReturnPctOfPack: 1.2,
        title: 'Silver jackpot',
      },
    ],
  };
}

function goldTemplate(): PackTemplate {
  return {
    type: 'gold',
    label: 'Gold',
    tagline: 'High conviction — whale echoes & rare upside',
    cardsPerOpen: 5,
    jackpotBudgetBps: 180,
    maxNormalReturnPctOfPack: 0.28,
    maxJackpotReturnPctOfPack: 1.6,
    rewardPoolBudgetMultiplier: 80,
    outcomes: [
      {
        rarity: 'common',
        kind: 'token_reward',
        probabilityBps: 5000,
        minReturnPctOfPack: 0.06,
        maxReturnPctOfPack: 0.1,
        title: 'Gold floor',
      },
      {
        rarity: 'uncommon',
        kind: 'token_reward',
        probabilityBps: 3000,
        minReturnPctOfPack: 0.08,
        maxReturnPctOfPack: 0.12,
        title: 'Trend runner',
      },
      {
        rarity: 'uncommon',
        kind: 'points_multiplier',
        probabilityBps: 700,
        multiplier: 1.4,
        estimatedCostPctOfPack: 0.008,
        title: 'Points overdrive',
      },
      {
        rarity: 'rare',
        kind: 'token_reward',
        probabilityBps: 1000,
        minReturnPctOfPack: 0.1,
        maxReturnPctOfPack: 0.16,
        title: 'Whale echo',
      },
      {
        rarity: 'epic',
        kind: 'cashback_multiplier',
        probabilityBps: 200,
        multiplier: 1.55,
        estimatedCostPctOfPack: 0.015,
        title: 'Cashback prime',
      },
      {
        rarity: 'legendary',
        kind: 'legendary_reward',
        probabilityBps: 80,
        minReturnPctOfPack: 0.18,
        maxReturnPctOfPack: 0.26,
        title: 'Legend pull',
      },
      {
        rarity: 'mythic',
        kind: 'legendary_reward',
        probabilityBps: 20,
        minReturnPctOfPack: 0.55,
        maxReturnPctOfPack: 0.95,
        title: 'Gold jackpot',
      },
    ],
  };
}

function legendaryTemplate(): PackTemplate {
  return {
    type: 'legendary',
    label: 'Legendary',
    tagline: 'Top tier — boosts, passes & mythic hits',
    cardsPerOpen: 5,
    jackpotBudgetBps: 200,
    maxNormalReturnPctOfPack: 0.3,
    maxJackpotReturnPctOfPack: 1.8,
    rewardPoolBudgetMultiplier: 60,
    outcomes: [
      {
        rarity: 'common',
        kind: 'token_reward',
        probabilityBps: 4310,
        minReturnPctOfPack: 0.06,
        maxReturnPctOfPack: 0.1,
        title: 'Prime clip',
      },
      {
        rarity: 'uncommon',
        kind: 'token_reward',
        probabilityBps: 2600,
        minReturnPctOfPack: 0.08,
        maxReturnPctOfPack: 0.12,
        title: 'Desk legend',
      },
      {
        rarity: 'uncommon',
        kind: 'points_multiplier',
        probabilityBps: 1100,
        multiplier: 1.65,
        estimatedCostPctOfPack: 0.01,
        title: 'Points apex',
      },
      {
        rarity: 'rare',
        kind: 'cashback_multiplier',
        probabilityBps: 900,
        multiplier: 1.75,
        estimatedCostPctOfPack: 0.02,
        title: 'Rebate line',
      },
      {
        rarity: 'epic',
        kind: 'cashback_multiplier',
        probabilityBps: 600,
        multiplier: 2.1,
        estimatedCostPctOfPack: 0.025,
        title: 'Prime cashback',
      },
      {
        rarity: 'legendary',
        kind: 'rare_access_badge',
        probabilityBps: 400,
        badgeLabel: 'Alpha pass',
        estimatedCostPctOfPack: 0.005,
        title: 'Alpha Pass',
      },
      {
        rarity: 'legendary',
        kind: 'cashback_multiplier',
        probabilityBps: 80,
        multiplier: 1.9,
        estimatedCostPctOfPack: 0.022,
        title: '90% cashback window',
      },
      {
        rarity: 'mythic',
        kind: 'legendary_reward',
        probabilityBps: 10,
        minReturnPctOfPack: 0.6,
        maxReturnPctOfPack: 1.1,
        title: 'Mythic jackpot',
      },
    ],
  };
}

export const PACK_TEMPLATES: Record<PackType, PackTemplate> = {
  bronze: bronzeTemplate(),
  silver: silverTemplate(),
  gold: goldTemplate(),
  legendary: legendaryTemplate(),
};

export const PACK_TEMPLATE_LIST: PackTemplate[] = [
  PACK_TEMPLATES.bronze,
  PACK_TEMPLATES.silver,
  PACK_TEMPLATES.gold,
  PACK_TEMPLATES.legendary,
];

function assertTemplatesValidAtReferencePrice(): void {
  const referenceSolUsd = 72;
  const referencePrices: Record<PackType, number> = {
    bronze: 0.15,
    silver: 0.5,
    gold: 2,
    legendary: 5,
  };
  for (const template of PACK_TEMPLATE_LIST) {
    const price =
      referencePrices[template.type] ??
      buildPackConfigFromTemplate(template, 1).packPriceSol;
    const config = buildPackConfigFromTemplate(template, price);
    const report = computePackEconomics(config);
    if (!report.valid) {
      throw new Error(
        `Invalid pack template "${template.type}" @ ${price} SOL: ${report.errors.join('; ')}`,
      );
    }
  }
}

assertTemplatesValidAtReferencePrice();
