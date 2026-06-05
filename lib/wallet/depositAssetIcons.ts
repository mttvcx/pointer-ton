import type { AppChainId } from '@/lib/chains/appChain';
import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';

/** Chain logos for deposit network picker + QR center mark. */
export function depositChainIconSrc(chain: AppChainId): string {
  return CHAIN_ICON_PNG[chain];
}

/** Stable / jetton marks shown under "Accepting". */
export const DEPOSIT_TOKEN_ICON_SRC: Record<string, string> = {
  EURC: '/logos/protocols/eurc.png',
  PYUSD: '/logos/protocols/pyusd.png',
  TON: '/chains/ton.png',
  USD1: '/logos/protocols/usd1.png',
  USDC: '/logos/protocols/usdc.png',
  USDT: '/logos/protocols/usdt.svg',
  XO: '/logos/protocols/xo.png',
};

export function depositTokenIconSrc(symbol: string): string | null {
  return DEPOSIT_TOKEN_ICON_SRC[symbol.trim().toUpperCase()] ?? null;
}
