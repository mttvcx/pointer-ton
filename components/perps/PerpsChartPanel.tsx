'use client';

import type { PerpMarket } from '@/lib/perps/types';
import type { ResolutionString } from '@/types/tradingview';
import { PerpsLightweightChart } from '@/components/perps/PerpsLightweightChart';
import { PerpsTradingViewChart } from '@/components/perps/PerpsTradingViewChart';

const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D'] as const;

/** Hyperliquid tf → TradingView resolution (for the chart's initial interval). */
function tfToResolution(tf: string): ResolutionString {
  switch (tf) {
    case '1m':
      return '1';
    case '5m':
      return '5';
    case '15m':
      return '15';
    case '1H':
      return '60';
    case '4H':
      return '240';
    case '1D':
      return '1D';
    default:
      return '15';
  }
}

export function PerpsChartPanel({
  pair,
  tf,
}: {
  pair: PerpMarket;
  tf: (typeof TIMEFRAMES)[number];
  onTfChange: (t: (typeof TIMEFRAMES)[number]) => void;
}) {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg-base">
      <PerpsTradingViewChart
        coin={pair.coin}
        interval={tfToResolution(tf)}
        fallback={<PerpsLightweightChart coin={pair.coin} tf={tf} />}
      />
    </div>
  );
}

export { TIMEFRAMES };
