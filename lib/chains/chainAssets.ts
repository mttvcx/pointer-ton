import type { AppChainId } from '@/lib/chains/appChain';
import { APP_CHAIN_IDS } from '@/lib/chains/appChain';

/** Static PNGs in /public/chains — replace files to swap artwork. */
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
