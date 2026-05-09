import type { AppChainId } from '@/lib/chains/appChain';

/** Ticker shown on quick buy / balances (uppercase). */
export function nativeTicker(chain: AppChainId): string {
  switch (chain) {
    case 'sol':
      return 'SOL';
    case 'bnb':
      return 'BNB';
    case 'base':
      return 'BASE';
    case 'ton':
    default:
      return 'TON';
  }
}
