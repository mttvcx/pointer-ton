import type { AppChainId } from '@/lib/chains/appChain';
import { inferMintKind } from '@/lib/chains/mintKind';

/** Map an on-chain address string to the app header chain bucket we use for wallet intel. */
export function appChainForWalletAddress(
  addr: string,
  preferChain?: AppChainId,
): AppChainId {
  const k = inferMintKind(addr.trim());
  if (k === 'sol') return 'sol';
  if (k === 'ton') return 'ton';
  if (k === 'btc') {
    /** No BTC L1 toggle; intel surface follows Sol rails for now. */
    return 'sol';
  }
  if (k === 'evm') {
    if (
      preferChain === 'eth' ||
      preferChain === 'bnb' ||
      preferChain === 'base'
    ) {
      return preferChain;
    }
    return 'eth';
  }
  return preferChain ?? 'sol';
}
