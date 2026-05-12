'use client';

import { DEMO_PREDICTION_MARKETS } from '@/lib/perps/predictionMarketsDemo';
import { PredictionMarketItem } from '@/components/perps/PredictionMarketItem';
import { PolymarketPoweredBy } from '@/components/perps/PolymarketWordmark';
import { cn } from '@/lib/utils/cn';

export function PredictionMarketTicker({ onOpenMarket }: { onOpenMarket: (id: string) => void }) {
  const markets = DEMO_PREDICTION_MARKETS;

  return (
    <div
      className={cn(
        'perps-ticker-root relative border-b border-white/[0.06] bg-[#070a10]',
        'before:pointer-events-none before:absolute before:inset-y-0 before:left-0 before:z-[1] before:w-10 before:bg-gradient-to-r before:from-[#070a10] before:to-transparent',
        'after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:z-[1] after:w-10 after:bg-gradient-to-l after:from-[#070a10] after:to-transparent',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-white/[0.04] px-2.5 py-1.5 sm:items-center">
        <div>
          <h2 className="text-[11px] font-semibold tracking-tight text-fg-primary">Prediction markets</h2>
          <p className="mt-0.5 max-w-md text-[9px] leading-relaxed text-fg-muted">
            Forward-looking benchmarks from Polymarket-style venues — illustrative only here.
          </p>
        </div>
        <PolymarketPoweredBy className="shrink-0 text-right" />
      </div>
      <div className="overflow-hidden py-1.5">
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
