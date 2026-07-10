/**
 * Packs — thin mobile client over the existing pack backend. All the hard parts
 * (odds, payout, provable fairness, pricing, treasury) live server-side; mobile
 * just lists packs and opens them. Anonymous opens are SIMULATED (no charge, seed
 * revealed inline) so the whole experience works today; the real-money buy path
 * (pay → open with a payment tx) turns on when live commerce is enabled.
 */
import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export type PackType = 'bronze' | 'silver' | 'gold' | 'diamond' | 'legendary';

export type PackRarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'mythic';

export type PackOddsRow = { rarity: PackRarity; probabilityBps: number; probabilityPct: string; kinds: string[] };

export type Pack = {
  type: string;
  label: string;
  tagline: string;
  packPriceSol: number;
  minReturnSol: number;
  maxNormalReturnSol: number;
  maxPayoutSol: number;
  enabled: boolean;
  cardsPerOpen: number;
  odds: PackOddsRow[];
  approximateUsd?: number;
  solUsd?: number;
};

export type PacksResponse = {
  packs: Pack[];
  solUsd: number;
  solUsdSource?: 'live' | 'fallback';
  live: boolean;
  treasury: string | null;
};

export type PackReward = {
  id: string;
  rarity: PackRarity;
  kind: string;
  title: string;
  subtitle: string;
  displayValue: string;
  valueSol: number | null;
  valueUsd: number | null;
  multiplier: number | null;
  badgeLabel: string | null;
  tokenSymbol?: string | null;
  tokenName?: string | null;
  tokenIconUrl?: string | null;
  amountTokens?: number | null;
};

export type PackFairness = { serverSeedHash?: string; clientSeed?: string; nonce?: number; serverSeed?: string; forced?: boolean };

export type PackOpenResult = {
  openId: string;
  packType: string;
  packLabel: string;
  priceSol: number;
  rewards: PackReward[];
  totalTokenValueSol: number;
  highlightRarity: PackRarity;
  isJackpotPull: boolean;
  solUsd?: number;
  approximateUsd?: number;
  fairness?: PackFairness;
};

export type OpenResponse = {
  result: PackOpenResult;
  solUsd: number;
  ledger: 'live' | 'simulated';
};

export function usePacks() {
  return useQuery({ queryKey: ['packs'], queryFn: () => api<PacksResponse>('/api/packs'), staleTime: 60_000 });
}

/** Anonymous, simulated open — real odds + fairness, never charges. */
export function openPackSimulated(packType: string): Promise<OpenResponse> {
  return api<OpenResponse>('/api/packs/open', { method: 'POST', body: { packType } });
}

/* ---------------- display helpers ---------------- */

export function solToUsd(sol: number | null | undefined, solUsd: number): number {
  return (sol ?? 0) * solUsd;
}

export const RARITY: Record<PackRarity, { label: string; color: string }> = {
  common: { label: 'Common', color: '#C3C9D1' },
  uncommon: { label: 'Uncommon', color: '#3EC98B' },
  rare: { label: 'Rare', color: '#3D8BFF' },
  epic: { label: 'Epic', color: '#A855F7' },
  legendary: { label: 'Legendary', color: '#F0B429' },
  mythic: { label: 'Mythical', color: '#F5D06B' },
};

// Foil gradient per pack tier (we have no pack art assets, so the pack IS the foil).
export const PACK_FOIL: Record<string, [string, string, string]> = {
  bronze: ['#C6D3E0', '#8A97A6', '#5B6675'],
  silver: ['#EDF1F5', '#B7C0CB', '#8A94A2'],
  gold: ['#F3DE9A', '#D8B45B', '#9C7A2E'],
  legendary: ['#8FA6FF', '#6E56CF', '#3A2E7A'],
};

/** Foil for a pack, falling back to silver for unknown types. */
export function foilFor(type: string): [string, string, string] {
  return PACK_FOIL[type] ?? PACK_FOIL.silver;
}
