import type { CoinCommunitySummary } from '@/lib/communities/coinCommunity';

/** Client cache TTL — community stats are considered fresh for 60s. */
export const COIN_COMMUNITY_STALE_MS = 60_000;
export const COIN_COMMUNITY_GC_MS = 5 * 60_000;

export function coinCommunityQueryKey(mint: string) {
  return ['coin-community', mint] as const;
}

export async function fetchCoinCommunity(mint: string): Promise<CoinCommunitySummary> {
  const trimmed = mint.trim();
  if (!trimmed) throw new Error('empty token address');
  const r = await fetch(`/api/communities/${encodeURIComponent(trimmed)}`);
  if (!r.ok) throw new Error(`community fetch failed: ${r.status}`);
  return (await r.json()) as CoinCommunitySummary;
}
