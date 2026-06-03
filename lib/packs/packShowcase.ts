import type { PackType, RewardKind, RewardRarity } from '@/types/pack';
import { getPackConfig } from '@/lib/packs/packConfig';
import { PACK_SHOWCASE_SOL_USD } from '@/lib/packs/constants';
import { formatProbabilityBps } from '@/lib/packs/formatOdds';
import { PACK_TOKEN_POOL } from '@/lib/packs/packTokens';
import { rewardKindLabel } from '@/lib/packs/rarityTheme';

export type PackShowcaseItem = {
  id: string;
  rarity: RewardRarity;
  kind: RewardKind;
  title: string;
  subtitle: string;
  tokenSymbol: string | null;
  tokenIconUrl: string | null;
  valueSol: number | null;
  valueUsd: number | null;
  marketCapUsd: number | null;
  probabilityPct: string;
  displayValue: string;
};

const RANK: Record<RewardRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
};

/** Minimum rarity shown per pack tier — bronze shows less insane hits. */
const MIN_SHOWCASE_RANK: Record<PackType, number> = {
  bronze: RANK.rare,
  silver: RANK.epic,
  gold: RANK.legendary,
  legendary: RANK.legendary,
};

function pickTokenForRarity(rarity: RewardRarity) {
  if (rarity === 'mythic' || rarity === 'legendary') {
    return PACK_TOKEN_POOL.find((t) => t.id === 'troll') ?? PACK_TOKEN_POOL[0]!;
  }
  if (rarity === 'epic') return PACK_TOKEN_POOL.find((t) => t.id === 'wif') ?? PACK_TOKEN_POOL[0]!;
  if (rarity === 'rare') return PACK_TOKEN_POOL.find((t) => t.id === 'popcat') ?? PACK_TOKEN_POOL[0]!;
  return PACK_TOKEN_POOL.find((t) => t.id === 'moodeng') ?? PACK_TOKEN_POOL[0]!;
}

function slotShowcaseValueSol(
  kind: RewardKind,
  maxValueSol: number | undefined,
  multiplier: number | undefined,
): number | null {
  if (kind === 'token_reward' || kind === 'legendary_reward') {
    return maxValueSol ?? null;
  }
  if (kind === 'cashback_multiplier' || kind === 'points_multiplier') {
    const m = multiplier ?? 1;
    return Math.max(0.05, (m - 1) * 0.35);
  }
  return 0.12;
}

/** Top hits you can pull — sorted insane → less insane per pack tier. */
export function listPackShowcaseItems(packType: PackType): PackShowcaseItem[] {
  const config = getPackConfig(packType);
  const minRank = MIN_SHOWCASE_RANK[packType];
  const seen = new Set<string>();

  const rows = [...config.outcomes]
    .filter((o) => RANK[o.rarity] >= minRank)
    .sort((a, b) => {
      const valueA = slotShowcaseValueSol(a.kind, a.maxValueSol, a.multiplier) ?? 0;
      const valueB = slotShowcaseValueSol(b.kind, b.maxValueSol, b.multiplier) ?? 0;
      if (valueB !== valueA) return valueB - valueA;
      return RANK[b.rarity] - RANK[a.rarity];
    });

  const items: PackShowcaseItem[] = [];

  for (const slot of rows) {
    const key = `${slot.rarity}:${slot.kind}:${slot.title ?? ''}:${slot.maxValueSol ?? slot.multiplier ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);

    const token =
      slot.kind === 'token_reward' || slot.kind === 'legendary_reward'
        ? pickTokenForRarity(slot.rarity)
        : null;
    const valueSol = slotShowcaseValueSol(slot.kind, slot.maxValueSol, slot.multiplier);
    const valueUsd = valueSol != null ? valueSol * PACK_SHOWCASE_SOL_USD : null;

    let title = slot.title ?? rewardKindLabel(slot.kind);
    let subtitle = token?.name ?? rewardKindLabel(slot.kind);
    let displayValue = token ? `${valueSol?.toFixed(0) ?? '—'} SOL` : slot.badgeLabel ?? title;

    if (slot.kind === 'cashback_multiplier' || slot.kind === 'points_multiplier') {
      const pct = Math.round(((slot.multiplier ?? 1) - 1) * 100);
      displayValue = `+${pct}%`;
      subtitle = slot.kind === 'cashback_multiplier' ? 'Fee rebate window' : 'Earn multiplier';
    }

    if (slot.kind === 'rare_access_badge') {
      displayValue = slot.badgeLabel ?? 'Access';
      subtitle = 'Trader access';
    }

    items.push({
      id: key,
      rarity: slot.rarity,
      kind: slot.kind,
      title,
      subtitle,
      tokenSymbol: token?.symbol ?? null,
      tokenIconUrl: token?.iconUrl ?? null,
      valueSol,
      valueUsd,
      marketCapUsd: token?.fallbackMarketCapUsd ?? null,
      probabilityPct: formatProbabilityBps(slot.probabilityBps),
      displayValue,
    });
  }

  return items;
}
