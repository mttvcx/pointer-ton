import type { PackOpenResult, PackType, RewardRarity } from '@/types/pack';

export type PackRevealIntensity = 'calm' | 'hype' | 'jackpot';

const RANK: Record<RewardRarity, number> = {
  common: 0,
  uncommon: 1,
  rare: 2,
  epic: 3,
  legendary: 4,
  mythic: 5,
};

/** Bronze / silver — gentle rip, no confetti. */
export function isCalmPackType(packType: PackType): boolean {
  return packType === 'bronze' || packType === 'silver';
}

export function getOpenAnimationProfile(packType: PackType): 'calm' | 'standard' | 'intense' {
  if (isCalmPackType(packType)) return 'calm';
  if (packType === 'gold') return 'standard';
  return 'intense';
}

/** Legendary pack mythic token hit — the 0.01% helicopter pull. */
export function isJackpotPull(result: Pick<PackOpenResult, 'packType' | 'rewards'>): boolean {
  if (result.packType !== 'legendary') return false;
  return result.rewards.some((r) => r.kind === 'legendary_reward' && r.rarity === 'mythic');
}

export function resolveRevealIntensity(
  packType: PackType,
  result: Pick<PackOpenResult, 'rewards'> | null,
): PackRevealIntensity {
  if (result && isJackpotPull({ packType, rewards: result.rewards })) return 'jackpot';
  if (isCalmPackType(packType)) return 'calm';
  return 'hype';
}

export function shouldShowConfetti(intensity: PackRevealIntensity, rarity: RewardRarity): boolean {
  if (intensity === 'calm') return false;
  if (intensity === 'jackpot') return true;
  return RANK[rarity] >= RANK.epic;
}

export function shouldShowFireworks(intensity: PackRevealIntensity, rarity: RewardRarity): boolean {
  if (intensity === 'calm') return false;
  if (intensity === 'jackpot') return true;
  return RANK[rarity] >= RANK.legendary;
}

export function isEpicReveal(rarity: RewardRarity): boolean {
  return RANK[rarity] >= RANK.epic;
}

/** @deprecated use shouldShowFireworks */
export function isInsanePackPull(rarity: RewardRarity): boolean {
  return RANK[rarity] >= RANK.legendary;
}
