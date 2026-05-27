'use client';

import type { AppChainId } from '@/lib/chains/appChain';
import type { TokenExtendedMetrics } from '@/lib/types/tokenExtendedMetrics';
import { formatCompactUsd, formatNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';

/** 6h tape — Axiom header rail (token page top-right, aligned with trade panel). */
export function TradeTapeStrip({
  m,
  className,
}: {
  m: TokenExtendedMetrics;
  mint?: string;
  chain?: AppChainId;
  className?: string;
}) {
  const buys = m.buys6h ?? 0;
  const sells = m.sells6h ?? 0;
  const buyVol = m.buyVol6hUsd ?? 0;
  const sellVol = m.sellVol6hUsd ?? 0;
  const netVol = m.netVol6hUsd ?? 0;
  const volTotal = buyVol + sellVol;
  const buyRatio = volTotal > 0 ? buyVol / volTotal : 0.5;

  const columns = [
    {
      label: '6h Vol',
      value: formatCompactUsd(m.vol6hUsd ?? 0),
      valueClass: 'text-fg-primary',
    },
    {
      label: 'Buys',
      value: `${formatNumber(buys, { decimals: 0 })} / ${formatCompactUsd(buyVol)}`,
      valueClass: 'text-signal-bull',
    },
    {
      label: 'Sells',
      value: `${formatNumber(sells, { decimals: 0 })} / ${formatCompactUsd(sellVol)}`,
      valueClass: 'text-signal-bear',
    },
    {
      label: 'Net Vol.',
      value: `${netVol >= 0 ? '+' : ''}${formatCompactUsd(netVol)}`,
      valueClass: netVol < 0 ? 'text-signal-bear' : 'text-signal-bull',
      align: 'right' as const,
    },
  ];

  return (
    <div className={cn('min-w-0 font-sans', className)}>
      <div className="grid grid-cols-4 gap-x-2">
        {columns.map((col) => (
          <div
            key={col.label}
            className={cn('min-w-0', col.align === 'right' && 'text-right')}
          >
            <p className="truncate text-[10px] font-medium leading-none text-fg-muted/80">
              {col.label}
            </p>
            <p
              className={cn(
                'mt-1 truncate text-[11px] font-semibold tabular-nums leading-none',
                col.valueClass,
              )}
            >
              {col.value}
            </p>
          </div>
        ))}
      </div>

      <div className="mt-2.5 flex h-[2px] w-full overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className="h-full bg-signal-bull/90"
          style={{ width: `${Math.max(0, Math.min(100, buyRatio * 100))}%` }}
        />
        <div className="h-full flex-1 bg-signal-bear/90" />
      </div>
    </div>
  );
}
