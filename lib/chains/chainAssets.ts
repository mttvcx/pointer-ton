import type { AppChainId } from '@/lib/chains/appChain';
import { APP_CHAIN_IDS } from '@/lib/chains/appChain';

/**
 * Chain artwork in /public/chains.
 * BTC is the official Bitcoin orange mark (SVG, vector); SOL / BNB / BASE / TON
 * use the official high-res PNGs the team provided (transparent backgrounds).
 */
export const CHAIN_ICON_PNG: Record<AppChainId, string> = {
  sol: '/chains/sol.png',
  bnb: '/chains/bnb.png',
  base: '/chains/base.png',
  ton: '/chains/ton.png',
};

export const CHAIN_DROPDOWN_LABEL: Record<AppChainId, string> = {
  sol: 'Solana',
  bnb: 'BNB',
  base: 'Base',
  ton: 'The Open Network',
};

export const CHAIN_TICKER: Record<AppChainId, string> = {
  sol: 'SOL',
  bnb: 'BNB',
  base: 'BASE',
  ton: 'TON',
};

export const ORDERED_CHAINS: AppChainId[] = [...APP_CHAIN_IDS];

/**
 * Points ecosystem strip — same artwork as the header chain dropdown ({@link CHAIN_ICON_PNG}).
 * Hyperliquid is not in {@link AppChainId}; add `/public/chains/hyperliquid.png` (optional fallback in UI).
 */
export const POINTS_ECOSYSTEM_CHAIN_ICON = {
  sol: CHAIN_ICON_PNG.sol,
  ton: CHAIN_ICON_PNG.ton,
  base: CHAIN_ICON_PNG.base,
  bnb: CHAIN_ICON_PNG.bnb,
  /** Not in AppChainId; bundled vector (other chains use same PNGs as the header dropdown). */
  hyperliquid: '/chains/hyperliquid.svg',
} as const;

export type PointsEcosystemIconId = keyof typeof POINTS_ECOSYSTEM_CHAIN_ICON;
