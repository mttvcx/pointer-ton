import type { AppChainId } from '@/lib/chains/appChain';
import { inferMintKind, mintMatchesAppChain } from '@/lib/chains/mintKind';
import type { Tables } from '@/lib/supabase/types';

/** Gecko Terminal network slug stored on `tokens.raw_metadata.geckoNetwork`. */
export type GeckoEvmNetwork = 'eth' | 'bsc' | 'base';

export function geckoNetworkFromRawMetadata(raw: unknown): GeckoEvmNetwork | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const n = (raw as Record<string, unknown>).geckoNetwork;
  if (n === 'eth' || n === 'bsc' || n === 'base') return n;
  return null;
}

export function appChainFromGeckoNetwork(n: GeckoEvmNetwork): AppChainId {
  if (n === 'eth') return 'eth';
  if (n === 'bsc') return 'bnb';
  return 'base';
}

export function geckoNetworkForAppChain(chain: AppChainId): GeckoEvmNetwork | null {
  if (chain === 'eth') return 'eth';
  if (chain === 'bnb') return 'bsc';
  if (chain === 'base') return 'base';
  return null;
}

function launchPadHintsAppChain(launchPad: string | null | undefined, chain: AppChainId): boolean {
  const p = (launchPad ?? '').toLowerCase().trim();
  if (!p) return false;
  if (chain === 'eth') {
    return (
      p === 'eth' ||
      p === 'ethereum' ||
      p.includes('uniswap') ||
      p.includes('clanker') ||
      p.includes('virtual')
    );
  }
  if (chain === 'bnb') {
    return p === 'bsc' || p.includes('four') || p.includes('pancake') || p.includes('flap');
  }
  if (chain === 'base') {
    return (
      p === 'base' ||
      p.includes('clanker') ||
      p.includes('zora') ||
      p.includes('bankr') ||
      p.includes('virtual') ||
      p.includes('flaunch')
    );
  }
  return false;
}

/**
 * Disambiguate `0x…` token rows across ETH / BNB / Base using ingest metadata.
 * Wallet addresses still use {@link mintMatchesAppChain} (any EVM header accepts `0x`).
 */
export function tokenMatchesAppChain(
  token: Pick<Tables<'tokens'>, 'mint' | 'raw_metadata' | 'launch_pad'>,
  chain: AppChainId,
): boolean {
  if (!mintMatchesAppChain(token.mint, chain)) return false;
  if (chain !== 'eth' && chain !== 'bnb' && chain !== 'base') return true;

  const gn = geckoNetworkFromRawMetadata(token.raw_metadata);
  if (gn) return appChainFromGeckoNetwork(gn) === chain;

  return launchPadHintsAppChain(token.launch_pad, chain);
}
