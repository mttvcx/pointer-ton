import type { RewardRarity } from '@/types/pack';

export type PackTokenDef = {
  id: string;
  symbol: string;
  name: string;
  mint: string;
  iconUrl: string;
  fallbackPriceUsd: number;
  fallbackMarketCapUsd: number;
};

/** Pack reward pool — icons in /public/packs/. */
export const PACK_TOKEN_POOL: PackTokenDef[] = [
  {
    id: 'troll',
    symbol: 'TROLL',
    name: 'Troll',
    mint: '5UUH9RTDiSpq6HNQc1w3rAHTKQ7CcrM9479c3M9pump',
    iconUrl: '/packs/troll.jpg',
    fallbackPriceUsd: 0.076,
    fallbackMarketCapUsd: 75_700_000,
  },
  {
    id: 'wif',
    symbol: 'WIF',
    name: 'dogwifhat',
    mint: 'EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm',
    iconUrl: '/logos/protocols/bonk.png',
    fallbackPriceUsd: 1.42,
    fallbackMarketCapUsd: 1_420_000_000,
  },
  {
    id: 'popcat',
    symbol: 'POPCAT',
    name: 'Popcat',
    mint: '7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHd8LNhS7dVel',
    iconUrl: '/branding/pointer-bird.png',
    fallbackPriceUsd: 0.89,
    fallbackMarketCapUsd: 870_000_000,
  },
  {
    id: 'moodeng',
    symbol: 'MOODENG',
    name: 'Moo Deng',
    mint: 'ED5nyyWEzpPPiWimP8vYm7sD7XJqYQKQv8K9m8pump',
    iconUrl: '/branding/pointer-bird-transparent.png',
    fallbackPriceUsd: 0.34,
    fallbackMarketCapUsd: 340_000_000,
  },
  {
    id: 'fwog',
    symbol: 'FWOG',
    name: 'Fwog',
    mint: 'A8C3xuqscfmyLrte3VmTqrAq8kgMASius9AFNANwpump',
    iconUrl: '/branding/pointer-bird.png',
    fallbackPriceUsd: 0.12,
    fallbackMarketCapUsd: 120_000_000,
  },
];

const RARITY_TOKEN_BIAS: Record<RewardRarity, string[]> = {
  common: ['fwog', 'moodeng'],
  uncommon: ['moodeng', 'popcat'],
  rare: ['popcat', 'wif'],
  epic: ['wif', 'troll'],
  legendary: ['troll', 'wif'],
  mythic: ['troll'],
};

export function pickPackToken(rarity: RewardRarity, rng: () => number): PackTokenDef {
  const ids = RARITY_TOKEN_BIAS[rarity] ?? ['troll'];
  const id = ids[Math.floor(rng() * ids.length)] ?? 'troll';
  return PACK_TOKEN_POOL.find((t) => t.id === id) ?? PACK_TOKEN_POOL[0]!;
}

export function getPackTokenById(id: string): PackTokenDef | null {
  return PACK_TOKEN_POOL.find((t) => t.id === id) ?? null;
}
