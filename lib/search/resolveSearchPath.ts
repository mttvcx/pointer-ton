import type { AppChainId } from '@/lib/chains/appChain';
import { mintMatchesAppChain, inferMintKind } from '@/lib/chains/mintKind';
import {
  looksLikeEnsName,
  normalizeEvmAddress,
} from '@/lib/ethereum/EthereumSearch';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

export type SearchResolveKind = 'mint' | 'wallet';

/** Whether the query shape belongs on the active header chain. */
export function searchQueryMatchesActiveChain(q: string, activeChain: AppChainId): boolean {
  const trimmed = q.trim();
  if (!trimmed) return false;
  if (activeChain === 'eth' && looksLikeEnsName(trimmed)) return true;
  return mintMatchesAppChain(trimmed, activeChain);
}

/**
 * Build navigation path without Helius RPC (Solana defaults to token page for pump CAs).
 * Optional `kind` from lightweight resolve when available.
 */
export function buildSearchPathForQuery(
  q: string,
  activeChain: AppChainId,
  kind?: SearchResolveKind,
): { path: string; resolved: string; chain: AppChainId } | null {
  const trimmed = q.trim();
  if (!searchQueryMatchesActiveChain(trimmed, activeChain)) return null;

  const ton = normalizeTonAddress(trimmed);
  if (ton && activeChain === 'ton') {
    const k = kind ?? 'mint';
    return {
      resolved: ton,
      path: k === 'wallet' ? `/wallet/${ton}` : `/token/${ton}`,
      chain: 'ton',
    };
  }

  const evm = normalizeEvmAddress(trimmed);
  if (evm && (activeChain === 'eth' || activeChain === 'bnb' || activeChain === 'base')) {
    const k = kind ?? 'mint';
    return {
      resolved: evm,
      path: k === 'wallet' ? `/wallet/${evm}` : `/token/${evm}`,
      chain: activeChain,
    };
  }

  if (inferMintKind(trimmed) === 'sol' && activeChain === 'sol') {
    const k = kind ?? 'mint';
    return {
      resolved: trimmed,
      path: k === 'wallet' ? `/wallet/${trimmed}` : `/token/${trimmed}`,
      chain: 'sol',
    };
  }

  return null;
}
