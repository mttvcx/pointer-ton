import type { PackOpenResult, PackType, RewardRarity } from '@/types/pack';
import { isCalmPackType } from '@/lib/packs/pullIntensity';

/** Cinematic celebration matched to pull tier. */
export type PackCelebration =
  | 'none'
  /** Epic on gold/legendary — glitch zoom + green candle surge. */
  | 'candle_surge'
  /** Legendary elite — vault doors open, camera zoom, card inside. */
  | 'vault_open'
  /** Mythic 0.01% — full helicopter winch (no skip). */
  | 'helicopter_jackpot';

export type PackTestCelebration = 'jackpot' | 'legendary_elite' | 'epic_surge';

/** Pure-black beat after pack burst — signals mythic before heli. */
export const JACKPOT_STING_MS = 2_400;

/** Floor-pull helicopter rescue. */
export const JACKPOT_HELI_SEQUENCE_MS = 12_000;

const RANK: Record<RewardRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
};

export function resolvePackCelebration(
  packType: PackType,
  result: Pick<PackOpenResult, 'rewards' | 'isJackpotPull'>,
): PackCelebration {
  if (result.isJackpotPull) return 'helicopter_jackpot';
  if (isCalmPackType(packType)) return 'none';

  const top = result.rewards[0];
  if (!top) return 'none';

  if (
    top.rarity === 'legendary' &&
    (top.kind === 'legendary_reward' || top.kind === 'token_reward')
  ) {
    return 'vault_open';
  }

  if ((packType === 'gold' || packType === 'legendary') && top.rarity === 'epic') {
    return 'candle_surge';
  }

  return 'none';
}

export function celebrationBlocksSkip(celebration: PackCelebration): boolean {
  return celebration === 'helicopter_jackpot';
}

/** Map dev test mode → celebration stage (does not affect live rolls). */
export function celebrationFromTestMode(mode: PackTestCelebration): PackCelebration | null {
  if (mode === 'jackpot') return 'helicopter_jackpot';
  if (mode === 'legendary_elite') return 'vault_open';
  if (mode === 'epic_surge') return 'candle_surge';
  return null;
}

export function rarityRank(r: RewardRarity): number {
  return RANK[r];
}
