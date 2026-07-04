'use client';

import type { PerpMarket } from '@/lib/perps/types';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/formatters';
import { PerpsLightweightChart } from '@/components/perps/PerpsLightweightChart';

const TIMEFRAMES = ['1m', '5m', '15m', '1H', '4H', '1D'] as const;

function priceDecimals(mark: number): number {
  if (mark >= 5000) return 0;
  if (mark >= 500) return 1;
  return 2;
}

export function PerpsChartPanel({
  pair,
  tf,
  onTfChange,
}: {
  pair: PerpMarket;
  tf: (typeof TIMEFRAMES)[number];
  onTfChange: (t: (typeof TIMEFRAMES)[number]) => void;
}) {
  const dec = priceDecimals(pair.mark);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-bg-base">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border-subtle bg-bg-raised px-2 py-1">
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-[12px] font-semibold text-fg-primary">{pair.label}</span>
          <span className="rounded bg-bg-hover px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-fg-secondary">
            {formatNumber(pair.mark, { decimals: dec })}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-0.5">
          {TIMEFRAMES.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onTfChange(t)}
              className={cn(
                'rounded px-2 py-0.5 text-[10px] font-semibold tabular-nums transition-colors',
                tf === t
                  ? 'bg-accent-primary/20 text-accent-glow ring-1 ring-accent-primary/30'
                  : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </div>
      <div className="relative min-h-[280px] flex-1 bg-bg-base lg:min-h-0">
        <PerpsLightweightChart coin={pair.coin} tf={tf} />
      </div>
    </div>
  );
}

export { TIMEFRAMES };
