import { formatProbabilityBps } from '@/lib/packs/formatOdds';
import type {
  PackConfig,
  PackEconomicsReport,
  PackOddsRow,
  PackOutcomeSlot,
  PackPublicConfig,
  PackType,
  RewardKind,
  RewardRarity,
} from '@/types/pack';

const RARITY_ORDER: RewardRarity[] = [
  'common',
  'uncommon',
  'rare',
  'epic',
  'legendary',
  'mythic',
];

function slotEvSol(slot: PackOutcomeSlot): number {
  if (slot.kind === 'token_reward' || slot.kind === 'legendary_reward') {
    const lo = slot.minValueSol ?? 0;
    const hi = slot.maxValueSol ?? lo;
    return ((lo + hi) / 2) * (slot.probabilityBps / 10_000);
  }
  if (slot.kind === 'cashback_multiplier' || slot.kind === 'points_multiplier') {
    const m = slot.multiplier ?? 1;
    const implied = (m - 1) * 0.08;
    return implied * (slot.probabilityBps / 10_000);
  }
  if (slot.kind === 'rare_access_badge') {
    return 0.02 * (slot.probabilityBps / 10_000);
  }
  return 0;
}

export function computePackEconomics(config: PackConfig): PackEconomicsReport {
  const errors: string[] = [];
  const probSum = config.outcomes.reduce((s, o) => s + o.probabilityBps, 0);
  if (probSum !== 10_000) {
    errors.push(`Outcomes must sum to 10_000 bps (got ${probSum})`);
  }

  const expectedValueSol = config.outcomes.reduce((s, o) => s + slotEvSol(o), 0);
  const houseEdgeSol = config.packPriceSol - expectedValueSol;
  const houseEdgeBps = Math.round((houseEdgeSol / config.packPriceSol) * 10_000);

  if (expectedValueSol >= config.packPriceSol) {
    errors.push(
      `EV (${expectedValueSol.toFixed(4)} SOL) must stay below price (${config.packPriceSol} SOL)`,
    );
  }
  if (config.maxPayoutSol > config.rewardPoolBudgetSol) {
    errors.push(
      `maxPayoutSol (${config.maxPayoutSol}) exceeds rewardPoolBudgetSol (${config.rewardPoolBudgetSol})`,
    );
  }

  const targetEv = config.packPriceSol * (1 - config.targetHouseMarginBps / 10_000);
  if (expectedValueSol > targetEv * 1.08) {
    errors.push(
      `EV (${expectedValueSol.toFixed(4)}) exceeds target band for ${config.targetHouseMarginBps} bps margin`,
    );
  }

  return {
    expectedValueSol,
    houseEdgeSol,
    houseEdgeBps,
    valid: errors.length === 0,
    errors,
  };
}

function buildOddsRows(outcomes: PackOutcomeSlot[]): PackOddsRow[] {
  const byRarity = new Map<RewardRarity, { bps: number; kinds: Set<RewardKind> }>();
  for (const o of outcomes) {
    const cur = byRarity.get(o.rarity) ?? { bps: 0, kinds: new Set<RewardKind>() };
    cur.bps += o.probabilityBps;
    cur.kinds.add(o.kind);
    byRarity.set(o.rarity, cur);
  }
  return RARITY_ORDER.filter((r) => byRarity.has(r)).map((rarity) => {
    const row = byRarity.get(rarity)!;
    return {
      rarity,
      probabilityBps: row.bps,
      probabilityPct: formatProbabilityBps(row.bps),
      kinds: [...row.kinds],
    };
  });
}

function bronzeOutcomes(): PackOutcomeSlot[] {
  return [
    {
      rarity: 'common',
      kind: 'token_reward',
      probabilityBps: 6200,
      minValueSol: 0.05,
      maxValueSol: 0.12,
      title: 'Scout pull',
    },
    {
      rarity: 'uncommon',
      kind: 'token_reward',
      probabilityBps: 2200,
      minValueSol: 0.1,
      maxValueSol: 0.18,
      title: 'Momentum clip',
    },
    {
      rarity: 'uncommon',
      kind: 'points_multiplier',
      probabilityBps: 800,
      multiplier: 1.15,
      title: 'Points surge',
    },
    {
      rarity: 'rare',
      kind: 'token_reward',
      probabilityBps: 650,
      minValueSol: 0.16,
      maxValueSol: 0.22,
      title: 'Alpha ticket',
    },
    {
      rarity: 'epic',
      kind: 'cashback_multiplier',
      probabilityBps: 120,
      multiplier: 1.2,
      title: 'Cashback boost',
    },
    {
      rarity: 'legendary',
      kind: 'rare_access_badge',
      probabilityBps: 25,
      badgeLabel: 'Bronze insider',
      title: 'Insider badge',
    },
    {
      rarity: 'mythic',
      kind: 'legendary_reward',
      probabilityBps: 5,
      minValueSol: 1.2,
      maxValueSol: 2.5,
      title: 'Jackpot clip',
    },
  ];
}

function silverOutcomes(): PackOutcomeSlot[] {
  return [
    {
      rarity: 'common',
      kind: 'token_reward',
      probabilityBps: 5400,
      minValueSol: 0.25,
      maxValueSol: 0.55,
      title: 'Core rotation',
    },
    {
      rarity: 'uncommon',
      kind: 'token_reward',
      probabilityBps: 2500,
      minValueSol: 0.45,
      maxValueSol: 0.72,
      title: 'Desk favorite',
    },
    {
      rarity: 'uncommon',
      kind: 'points_multiplier',
      probabilityBps: 900,
      multiplier: 1.25,
      title: 'Points burst',
    },
    {
      rarity: 'rare',
      kind: 'token_reward',
      probabilityBps: 850,
      minValueSol: 0.68,
      maxValueSol: 0.85,
      title: 'Smart money hit',
    },
    {
      rarity: 'epic',
      kind: 'cashback_multiplier',
      probabilityBps: 220,
      multiplier: 1.35,
      title: 'Fee rebate',
    },
    {
      rarity: 'legendary',
      kind: 'rare_access_badge',
      probabilityBps: 100,
      badgeLabel: 'Silver syndicate',
      title: 'Syndicate pass',
    },
    {
      rarity: 'mythic',
      kind: 'legendary_reward',
      probabilityBps: 30,
      minValueSol: 4,
      maxValueSol: 8,
      title: 'Silver jackpot',
    },
  ];
}

function goldOutcomes(): PackOutcomeSlot[] {
  return [
    {
      rarity: 'common',
      kind: 'token_reward',
      probabilityBps: 4800,
      minValueSol: 2,
      maxValueSol: 3.2,
      title: 'Gold floor',
    },
    {
      rarity: 'uncommon',
      kind: 'token_reward',
      probabilityBps: 3000,
      minValueSol: 2.8,
      maxValueSol: 3.9,
      title: 'Trend runner',
    },
    {
      rarity: 'uncommon',
      kind: 'points_multiplier',
      probabilityBps: 700,
      multiplier: 1.4,
      title: 'Points overdrive',
    },
    {
      rarity: 'rare',
      kind: 'token_reward',
      probabilityBps: 1000,
      minValueSol: 3.6,
      maxValueSol: 4.6,
      title: 'Whale echo',
    },
    {
      rarity: 'epic',
      kind: 'cashback_multiplier',
      probabilityBps: 380,
      multiplier: 1.55,
      title: 'Cashback prime',
    },
    {
      rarity: 'legendary',
      kind: 'legendary_reward',
      probabilityBps: 100,
      minValueSol: 8,
      maxValueSol: 18,
      title: 'Legend pull',
    },
    {
      rarity: 'mythic',
      kind: 'legendary_reward',
      probabilityBps: 20,
      minValueSol: 45,
      maxValueSol: 125,
      title: 'Gold jackpot',
    },
  ];
}

function legendaryOutcomes(): PackOutcomeSlot[] {
  return [
    {
      rarity: 'common',
      kind: 'token_reward',
      probabilityBps: 4229,
      minValueSol: 10,
      maxValueSol: 14,
      title: 'Prime clip',
    },
    {
      rarity: 'uncommon',
      kind: 'token_reward',
      probabilityBps: 2600,
      minValueSol: 13,
      maxValueSol: 18,
      title: 'Desk legend',
    },
    {
      rarity: 'uncommon',
      kind: 'points_multiplier',
      probabilityBps: 1100,
      multiplier: 1.65,
      title: 'Points apex',
    },
    {
      rarity: 'rare',
      kind: 'cashback_multiplier',
      probabilityBps: 900,
      multiplier: 1.75,
      title: 'Rebate line',
    },
    {
      rarity: 'epic',
      kind: 'cashback_multiplier',
      probabilityBps: 650,
      multiplier: 2.1,
      title: 'Prime cashback',
    },
    {
      rarity: 'legendary',
      kind: 'rare_access_badge',
      probabilityBps: 420,
      badgeLabel: 'Alpha pass',
      title: 'Alpha Pass',
    },
    {
      rarity: 'legendary',
      kind: 'cashback_multiplier',
      probabilityBps: 100,
      multiplier: 1.9,
      title: '90% cashback window',
    },
    {
      rarity: 'mythic',
      kind: 'legendary_reward',
      probabilityBps: 1,
      minValueSol: 55,
      maxValueSol: 140,
      title: 'Mythic jackpot',
    },
  ];
}

const RAW_CONFIGS: PackConfig[] = [
  {
    type: 'bronze',
    label: 'Bronze',
    tagline: 'Entry clip — scout wallets & micro runners',
    packPriceSol: 0.25,
    targetHouseMarginBps: 1800,
    minReturnSol: 0.05,
    maxNormalReturnSol: 0.22,
    rareChanceBps: 775,
    legendaryChanceBps: 25,
    jackpotChanceBps: 5,
    maxPayoutSol: 2.5,
    rewardPoolBudgetSol: 50,
    enabled: true,
    outcomes: bronzeOutcomes(),
    cardsPerOpen: 3,
  },
  {
    type: 'silver',
    label: 'Silver',
    tagline: 'Rotation pack — desk favorites & fee boosts',
    packPriceSol: 1,
    targetHouseMarginBps: 1600,
    minReturnSol: 0.25,
    maxNormalReturnSol: 0.85,
    rareChanceBps: 850,
    legendaryChanceBps: 100,
    jackpotChanceBps: 30,
    maxPayoutSol: 8,
    rewardPoolBudgetSol: 200,
    enabled: true,
    outcomes: silverOutcomes(),
    cardsPerOpen: 4,
  },
  {
    type: 'gold',
    label: 'Gold',
    tagline: 'High conviction — whale echoes & rare upside',
    packPriceSol: 5,
    targetHouseMarginBps: 1500,
    minReturnSol: 2,
    maxNormalReturnSol: 4.6,
    rareChanceBps: 1000,
    legendaryChanceBps: 100,
    jackpotChanceBps: 20,
    maxPayoutSol: 125,
    rewardPoolBudgetSol: 500,
    enabled: true,
    outcomes: goldOutcomes(),
    cardsPerOpen: 5,
  },
  {
    type: 'legendary',
    label: 'Legendary',
    tagline: 'Top tier — boosts, passes & mythic hits',
    packPriceSol: 25,
    targetHouseMarginBps: 1400,
    minReturnSol: 10,
    maxNormalReturnSol: 22,
    rareChanceBps: 900,
    legendaryChanceBps: 520,
    jackpotChanceBps: 30,
    maxPayoutSol: 140,
    rewardPoolBudgetSol: 2000,
    enabled: true,
    outcomes: legendaryOutcomes(),
    cardsPerOpen: 5,
  },
];

function assertConfigsValid(configs: PackConfig[]): void {
  for (const c of configs) {
    const report = computePackEconomics(c);
    if (!report.valid) {
      throw new Error(`Invalid pack config "${c.type}": ${report.errors.join('; ')}`);
    }
  }
}

assertConfigsValid(RAW_CONFIGS);

export const PACK_CONFIGS: Record<PackType, PackConfig> = Object.fromEntries(
  RAW_CONFIGS.map((c) => [c.type, c]),
) as Record<PackType, PackConfig>;

export const PACK_CONFIG_LIST: PackConfig[] = RAW_CONFIGS;

export function getEnabledPacks(): PackConfig[] {
  return PACK_CONFIG_LIST.filter((p) => p.enabled);
}

export function getPackConfig(type: PackType): PackConfig {
  const cfg = PACK_CONFIGS[type];
  if (!cfg?.enabled) throw new Error(`Pack disabled: ${type}`);
  return cfg;
}

export function toPublicPackConfig(config: PackConfig): PackPublicConfig {
  const kinds = [...new Set(config.outcomes.map((o) => o.kind))];
  return {
    type: config.type,
    label: config.label,
    tagline: config.tagline,
    packPriceSol: config.packPriceSol,
    minReturnSol: config.minReturnSol,
    maxNormalReturnSol: config.maxNormalReturnSol,
    rareChanceBps: config.rareChanceBps,
    legendaryChanceBps: config.legendaryChanceBps,
    jackpotChanceBps: config.jackpotChanceBps,
    maxPayoutSol: config.maxPayoutSol,
    enabled: config.enabled,
    cardsPerOpen: config.cardsPerOpen,
    odds: buildOddsRows(config.outcomes),
    rewardKinds: kinds,
    economics: computePackEconomics(config),
  };
}

export function listPublicPackConfigs(): PackPublicConfig[] {
  return getEnabledPacks().map(toPublicPackConfig);
}
