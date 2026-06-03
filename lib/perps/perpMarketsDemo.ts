import type { PerpMarket } from '@/lib/perps/types';

/** @deprecated Use live markets from /api/perps/markets — kept for Storybook/tests only */
export type { PerpMarket };

export { fmtPerpUsdCompact } from '@/lib/hyperliquid/markets';

export const DEMO_PERP_MARKETS: PerpMarket[] = [];
