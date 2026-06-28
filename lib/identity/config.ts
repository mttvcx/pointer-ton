import type { IdentitySourceName } from '@/lib/identity/types';

export const IDENTITY_SOURCE_PRIORITY: Record<string, number> = {
  pointer: 100,
  manual: 80,
  kolscan: 60,
  axiom: 58,
  cabalspy: 57,
  gmgn: 55,
};

export function sourcePriority(source: IdentitySourceName): number {
  return IDENTITY_SOURCE_PRIORITY[source.toLowerCase()] ?? 40;
}

/** Max wallets per batch lookup (holders / top traders). */
export const IDENTITY_BATCH_LOOKUP_MAX = 200;

/** In-memory resolve cache TTL (ms). */
export const IDENTITY_RESOLVE_CACHE_TTL_MS = 60_000;

export const KOLSCAN_LEADERBOARD_URL = 'https://kolscan.io/leaderboard';

export const GMGN_CHAIN_PATH: Record<string, string> = {
  eth: 'eth',
  bnb: 'bsc',
  base: 'base',
};

export function gmgnWalletCopyUrl(chain: 'eth' | 'bnb' | 'base'): string {
  const slug = GMGN_CHAIN_PATH[chain] ?? 'eth';
  return `https://gmgn.ai/trade?chain=${slug}&tab=renowned`;
}
