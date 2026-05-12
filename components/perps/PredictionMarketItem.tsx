'use client';

import type { PredictionMarketDemo } from '@/lib/perps/predictionMarketsDemo';
import { noPct } from '@/lib/perps/predictionMarketsDemo';
import { PredictionMarketBadge } from '@/components/perps/PredictionMarketBadge';
import { PredictionMarketMiniChart } from '@/components/perps/PredictionMarketMiniChart';
import { cn } from '@/lib/utils/cn';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';

function TrendGlyph({ trend }: { trend: PredictionMarketDemo['trend'] }) {
  const cls = 'h-3 w-3 shrink-0 opacity-90';
  if (trend === 'up') return <TrendingUp className={cn(cls, 'text-signal-bull')} strokeWidth={2} aria-hidden />;
  if (trend === 'down') return <TrendingDown className={cn(cls, 'text-signal-bear')} strokeWidth={2} aria-hidden />;
  return <Minus className={cn(cls, 'text-fg-muted')} strokeWidth={2} aria-hidden />;
}

export function PredictionMarketItem({
  market,
  onOpen,
}: {
  market: PredictionMarketDemo;
  onOpen: (id: string) => void;
}) {
  const n = noPct(market.yesPct);
  return (
    <button
      type="button"
      onClick={() => onOpen(market.id)}
      className={cn(
        'group/perp-pm relative flex min-w-[14.5rem] max-w-[16rem] shrink-0 snap-start flex-col gap-1 rounded-md',
        'bg-white/[0.02] px-2.5 py-2 text-left',
        'ring-1 ring-white/[0.06] transition-colors duration-150 hover:bg-white/[0.035] hover:ring-signal-info/25',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/50',
      )}
    >
      <div className="flex items-start gap-2">
        <TrendGlyph trend={market.trend} />
        <p className="min-w-0 flex-1 text-[11px] font-medium leading-snug tracking-tight text-fg-primary line-clamp-2">
          {market.title}
        </p>
        <PredictionMarketBadge category={market.category} />
      </div>
      <div className="flex items-end justify-between gap-2 pt-0.5">
        <div className="flex items-baseline gap-3 tabular-nums">
          <div>
            <span className="text-[8px] font-semibold uppercase tracking-wide text-fg-muted">Yes</span>
            <span className="ml-1 text-[12px] font-semibold tracking-tight text-signal-bull">{market.yesPct}%</span>
          </div>
          <div>
            <span className="text-[8px] font-semibold uppercase tracking-wide text-fg-muted">No</span>
            <span className="ml-1 text-[12px] font-semibold tracking-tight text-signal-bear">{n}%</span>
          </div>
        </div>
        <PredictionMarketMiniChart
          values={market.spark}
          emphasize
          className="opacity-40 transition-opacity duration-300 group-hover/perp-pm:opacity-100"
        />
      </div>
      {market.volumeUsdM != null || market.openInterestUsdM != null ? (
        <div className="flex flex-wrap gap-x-2 text-[9px] font-medium tabular-nums tracking-tight text-fg-muted/95">
          {market.volumeUsdM != null ? <span>Vol ${market.volumeUsdM.toFixed(1)}m</span> : null}
          {market.openInterestUsdM != null ? (
            <span>Open interest ${market.openInterestUsdM.toFixed(1)}m</span>
          ) : null}
        </div>
      ) : null}
    </button>
  );
}
