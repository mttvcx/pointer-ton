import type { AppChainId } from '@/lib/chains/appChain';
import { inferMintKind } from '@/lib/chains/mintKind';

/** Map an on-chain address string to the app header chain bucket we use for wallet intel. */
export function appChainForWalletAddress(addr: string): AppChainId {
  const k = inferMintKind(addr.trim());
  if (k === 'sol') return 'sol';
  if (k === 'ton') return 'ton';
  if (k === 'evm') return 'bnb';
  return 'sol';
}
