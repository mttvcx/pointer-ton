import type { AppChainId } from '@/lib/chains/appChain';

/**
 * Dexscreener hosts token avatars for many chains; works with plain <img> (no Next Image).
 * Falls back gracefully if a logo is missing upstream.
 */
export function dexScreenerTokenIconUrl(chain: AppChainId, address: string): string | null {
  const a = address.trim();
  if (!a) return null;
    switch (chain) {
    case 'sol':
      return `https://dd.dexscreener.com/ds-data/tokens/solana/${a}.png`;
    case 'bnb':
      return `https://dd.dexscreener.com/ds-data/tokens/bsc/${a}.png`;
    case 'base':
      return `https://dd.dexscreener.com/ds-data/tokens/base/${a}.png`;
    case 'ton':
      return null;
    default:
      return null;
  }
}
