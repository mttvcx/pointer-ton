'use client';

import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/shared/Skeleton';
import type { SyntheticStockMarket } from '@/lib/stocks/types';

/**
 * Lazy-load the stock terminal (and its chart) so the chunk loads after the
 * route shell paints. UI/placement is unchanged.
 */
const StockTerminal = dynamic(
  () => import('@/components/stocks/StockTerminal').then((m) => ({ default: m.StockTerminal })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-0 flex-1 flex-col">
        <Skeleton className="h-full min-h-[60vh] w-full rounded-lg" />
      </div>
    ),
  },
);

export function StockDetailView({ market }: { market: SyntheticStockMarket }) {
  return <StockTerminal market={market} />;
}
