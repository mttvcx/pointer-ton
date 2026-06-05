'use client';

import { StockTerminal } from '@/components/stocks/StockTerminal';
import type { SyntheticStockMarket } from '@/lib/stocks/types';

/** Stock perp terminal — same shell as `/perps`, not a Pulse token desk. */
export function StockDetailView({ market }: { market: SyntheticStockMarket }) {
  return <StockTerminal market={market} />;
}
