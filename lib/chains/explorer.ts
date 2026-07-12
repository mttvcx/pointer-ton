import type { AppChainId } from '@/lib/chains/appChain';

import { inferMintKind } from '@/lib/chains/mintKind';

/** Block explorer URL for a wallet / account on the selected app chain. */
export function explorerAccountUrlForChain(address: string, chain: AppChainId): string {
  const a = address.trim();
  if (inferMintKind(a) === 'btc') {
    return `https://mempool.space/address/${encodeURIComponent(a)}`;
  }
  switch (chain) {
    case 'sol':
      return `https://solscan.io/account/${encodeURIComponent(a)}`;
    case 'eth':
      return `https://etherscan.io/address/${encodeURIComponent(a)}`;
    case 'bnb':
      return `https://bscscan.com/address/${encodeURIComponent(a)}`;
    case 'base':
      return `https://basescan.org/address/${encodeURIComponent(a)}`;
    case 'robinhood':
      return `https://robinhoodchain.blockscout.com/address/${encodeURIComponent(a)}`;
    case 'ton':
    default:
      return `https://tonviewer.com/${encodeURIComponent(a)}`;
  }
}
