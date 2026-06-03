'use client';

import { DEMO_PREDICTION_MARKETS } from '@/lib/perps/predictionMarketsDemo';
import { PredictionMarketItem } from '@/components/perps/PredictionMarketItem';
import { cn } from '@/lib/utils/cn';

export function PredictionMarketTicker({
  onOpenMarket,
  compact = false,
}: {
  onOpenMarket: (id: string) => void;
  compact?: boolean;
}) {
  const markets = DEMO_PREDICTION_MARKETS;

  return (
    <div
      className={cn(
        'perps-ticker-root relative bg-bg-base',
        !compact && 'border-b border-border-subtle',
        'before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:z-[1] before:w-8 before:bg-gradient-to-r before:from-bg-base before:to-transparent',
        'after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:z-[1] after:w-8 after:bg-gradient-to-l after:from-bg-base after:to-transparent',
      )}
    >
      <div className="overflow-hidden py-1">
        <div className="perps-ticker-track flex w-max snap-x gap-1.5 pl-2 pr-1">
          {markets.map((m) => (
            <PredictionMarketItem key={`a-${m.id}`} market={m} onOpen={onOpenMarket} />
          ))}
          {markets.map((m) => (
            <PredictionMarketItem key={`b-${m.id}`} market={m} onOpen={onOpenMarket} />
          ))}
        </div>
      </div>
    </div>
  );
}
