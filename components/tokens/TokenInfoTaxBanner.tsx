'use client';

import { Percent } from 'lucide-react';
import { formatNumber } from '@/lib/utils/formatters';
import { tokenMetricCellSurface } from '@/lib/tokens/tokenInfoMetricColors';
import { cn } from '@/lib/utils/cn';

/** Full-width Axiom-style tax row — only render when `taxPct` is present and > 0. */
export function TokenInfoTaxBanner({ taxPct }: { taxPct: number }) {
  const valueClass =
    taxPct >= 5
      ? 'text-sm font-semibold tabular-nums text-signal-bear'
      : taxPct >= 1
        ? 'text-sm font-semibold tabular-nums text-signal-warn'
        : 'text-sm font-semibold tabular-nums text-signal-bull';

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-1 py-2.5',
        tokenMetricCellSurface(valueClass),
      )}
    >
      <div className={cn('inline-flex items-center gap-1', valueClass)}>
        <Percent className="h-3.5 w-3.5 shrink-0" strokeWidth={2.5} aria-hidden />
        <span>{formatNumber(taxPct, { decimals: 2 })}%</span>
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wide text-fg-muted">Tax %</div>
    </div>
  );
}

export function hasTokenTax(taxPct: number | null | undefined): taxPct is number {
  return taxPct != null && Number.isFinite(taxPct) && taxPct > 0;
}
