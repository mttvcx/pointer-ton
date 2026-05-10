'use client';

import { cn } from '@/lib/utils/cn';
import { formatCompactUsd } from '@/lib/utils/formatters';
import type { WalletAnalyticsPayload } from '@/lib/wallet-analytics/types';
import type { WalletAnalyticsTimeframe } from '@/lib/wallet-analytics/types';

function tfLabel(tf: WalletAnalyticsTimeframe): string {
  switch (tf) {
    case '1d':
      return '1d';
    case '7d':
      return '7d';
    case '30d':
      return '30d';
    case 'max':
      return 'Max';
    default:
      return tf;
  }
}

export function WalletPerformancePanel({
  data,
  timeframe,
}: {
  data: WalletAnalyticsPayload;
  timeframe: WalletAnalyticsTimeframe;
}) {
  const label = tfLabel(timeframe);
  const buckets = data.buckets;
  const total = buckets.reduce((s, b) => s + b.count, 0) || 1;

  return (
    <div className="flex min-h-0 flex-col rounded-xl border border-border-subtle/80 bg-bg-base/40 p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
        Performance
      </h3>

      <dl className="mt-4 space-y-2.5 text-[12px]">
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">{label} Total PNL</dt>
          <dd
            className={cn(
              'tabular-nums font-semibold',
              data.performance.totalPnlUsd != null && data.performance.totalPnlUsd >= 0
                ? 'text-signal-bull'
                : 'text-signal-bear',
            )}
          >
            {data.performance.totalPnlUsd != null
              ? formatCompactUsd(data.performance.totalPnlUsd)
              : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">{label} Realized PNL</dt>
          <dd
            className={cn(
              'tabular-nums font-semibold',
              data.performance.realizedPnlUsd != null && data.performance.realizedPnlUsd >= 0
                ? 'text-signal-bull'
                : 'text-signal-bear',
            )}
          >
            {data.performance.realizedPnlUsd != null
              ? formatCompactUsd(data.performance.realizedPnlUsd)
              : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">{label} TXNS</dt>
          <dd className="tabular-nums font-semibold text-fg-primary">
            {data.performance.txns != null ? data.performance.txns : '—'}
          </dd>
        </div>
      </dl>

      <p className="mt-5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
        Win / Loss distribution
      </p>
      <ul className="mt-2 space-y-1.5">
        {buckets.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-2 text-[11px]">
            <span className="flex items-center gap-2 text-fg-secondary">
              <span
                className={cn(
                  'h-2 w-2 rounded-full',
                  b.tone === 'bull' ? 'bg-accent-primary' : 'bg-signal-bear',
                )}
              />
              {b.label}
            </span>
            <span className="tabular-nums text-fg-primary">{b.count}</span>
          </li>
        ))}
      </ul>

      <div className="mt-3 flex h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
        {buckets.map((b) => (
          <div
            key={b.id}
            className={cn(b.tone === 'bull' ? 'bg-accent-primary/90' : 'bg-signal-bear/90')}
            style={{ width: `${(b.count / total) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}
