'use client';

import { PredictionTradeForm } from '@/components/predictions/PredictionTradeForm';
import type { PredictionMarket } from '@/lib/predictions/marketsDemo';

export function PredictionTradePanel({
  market,
  initialOutcome = 'yes',
}: {
  market: PredictionMarket;
  initialOutcome?: 'yes' | 'no';
}) {
  return (
    <div
      className="flex h-full min-h-0 flex-col border-l border-border-subtle bg-bg-hover/20"
      data-predictions-tour="trade-panel"
    >
      <div className="flex border-b border-border-subtle/40 px-3 py-2">
        <div className="flex rounded-md border border-border-subtle/60 p-0.5 text-[11px]">
          <span className="rounded-sm bg-bg-hover px-2.5 py-1 font-semibold text-fg-primary">Market</span>
          <span className="px-2.5 py-1 text-fg-muted">Limit</span>
        </div>
      </div>
      <PredictionTradeForm
        key={`${market.id}-${initialOutcome}`}
        market={market}
        initialOutcome={initialOutcome}
      />
    </div>
  );
}
