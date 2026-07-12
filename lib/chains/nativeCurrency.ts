import type { AppChainId } from '@/lib/chains/appChain';

/** Ticker shown on quick buy / balances (uppercase). */
export function nativeTicker(chain: AppChainId): string {
  switch (chain) {
    case 'sol':
      return 'SOL';
    case 'eth':
      return 'ETH';
    case 'bnb':
      return 'BNB';
    case 'base':
      return 'BASE';
    case 'robinhood':
      return 'ETH';
    case 'ton':
    default:
      return 'TON';
  }
}

/**
 * Symbol exposed by `/api/prices/tickers` for native spot when pricing USD conversion.
 */
export function nativeUsdTickerSymbol(chain: AppChainId): 'SOL' | 'TON' | 'BNB' | 'ETH' {
  switch (chain) {
    case 'sol':
      return 'SOL';
    case 'eth':
      return 'ETH';
    case 'bnb':
      return 'BNB';
    case 'base':
      return 'ETH';
    case 'robinhood':
      return 'ETH';
    case 'ton':
    default:
      return 'TON';
  }
}

/** Sub-unit labels for deterministic priority knobs (Solana presets use lamports; TON uses nanotons). */
export function nativePriorityFeeDenomLabel(chain: AppChainId): string {
  if (chain === 'sol') return 'lamports';
  if (chain === 'ton') return 'nanotons';
  return 'µ-units';
}
