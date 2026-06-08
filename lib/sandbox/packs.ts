'use client';

/**
 * Pointer Sandbox Mode v1 — fake pack roller.
 *
 * Pure local RNG. Does NOT hit the live pack-open route, does NOT touch live
 * commerce, payouts, or the real pack ledger. Results are credited into the
 * sandbox ledger only.
 */

import type { SandboxPackOpen } from '@/lib/sandbox/types';

export const SANDBOX_PACK_PRICES_SOL: Record<string, number> = {
  bronze: 0.1,
  silver: 0.5,
  gold: 2,
  legendary: 10,
};

const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
type Rarity = (typeof RARITIES)[number];

function rollRarity(packType: string): Rarity {
  const r = Math.random();
  const lucky = packType === 'legendary' ? 0.4 : packType === 'gold' ? 0.22 : packType === 'silver' ? 0.12 : 0.06;
  if (r < lucky * 0.15) return 'legendary';
  if (r < lucky * 0.5) return 'epic';
  if (r < lucky) return 'rare';
  if (r < lucky + 0.3) return 'uncommon';
  return 'common';
}

function rarityValueSol(rarity: Rarity, priceSol: number): number {
  const mult: Record<Rarity, number> = {
    common: 0.2,
    uncommon: 0.6,
    rare: 1.1,
    epic: 2.4,
    legendary: 6,
  };
  return Number((priceSol * mult[rarity] * (0.8 + Math.random() * 0.6)).toFixed(6));
}

/** Roll a fake pack open. `priceSol` is fake SOL the ledger will deduct. */
export function rollSandboxPack(packType: string): SandboxPackOpen {
  const priceSol = SANDBOX_PACK_PRICES_SOL[packType] ?? 0.1;
  const rewardCount = packType === 'legendary' ? 5 : packType === 'gold' ? 4 : 3;
  const rewards = Array.from({ length: rewardCount }, (_, i) => {
    const rarity = rollRarity(packType);
    const valueSol = rarityValueSol(rarity, priceSol);
    return {
      symbol: `SBXR${i + 1}`,
      mint: `SBXPACK${packType.toUpperCase()}${i}_${Math.floor(Math.random() * 1e6)}`,
      valueSol,
    };
  });
  let highlightRarity: Rarity = 'common';
  for (let i = 0; i < rewardCount; i++) {
    const rr = rollRarity(packType);
    if (RARITIES.indexOf(rr) > RARITIES.indexOf(highlightRarity)) highlightRarity = rr;
  }
  const totalValueSol = Number(rewards.reduce((s, r) => s + r.valueSol, 0).toFixed(6));

  return {
    openId: `SBXOPEN_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    packType,
    priceSol,
    highlightRarity,
    totalValueSol,
    rewards,
    createdAt: Date.now(),
  };
}
