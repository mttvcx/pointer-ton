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

  const tx = data.performance.txns;
  const wr = data.performance.winRatePct;
  const wins = tx != null && wr != null ? Math.round((tx * wr) / 100) : null;
  const losses = tx != null && wins != null ? Math.max(0, tx - wins) : null;
  const coinsTraded = data.positions.length;

  return (
    <div className="flex min-h-0 flex-col p-3">
      <h3 className="text-[10px] font-semibold uppercase tracking-[0.08em] text-fg-muted/90">
        Performance
      </h3>

      <dl className="mt-3 space-y-1.5 text-[11.5px]">
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">{label} realized PNL</dt>
          <dd
            className={cn(
              'tabular-nums font-semibold tracking-tight',
              data.performance.realizedPnlUsd != null && data.performance.realizedPnlUsd >= 0
                ? 'text-emerald-300/90'
                : 'text-rose-300/90',
            )}
          >
            {data.performance.realizedPnlUsd != null
              ? formatCompactUsd(data.performance.realizedPnlUsd)
              : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">TXNS</dt>
          <dd className="tabular-nums font-semibold text-fg-primary">
            {tx != null ? (
              <>
                {tx}
                {wins != null && losses != null ? (
                  <span className="ml-1 text-[10px] font-medium text-fg-muted">
                    ({wins}/{losses})
                  </span>
                ) : null}
              </>
            ) : (
              '—'
            )}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">Coins traded</dt>
          <dd className="tabular-nums font-semibold text-fg-primary">{coinsTraded}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">Wins</dt>
          <dd className="tabular-nums font-semibold text-emerald-300/90">{wins != null ? wins : '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">Losses</dt>
          <dd className="tabular-nums font-semibold text-rose-300/85">{losses != null ? losses : '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">Win rate</dt>
          <dd className="tabular-nums font-semibold text-emerald-200/90">
            {wr != null ? `${wr.toFixed(1)}%` : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">{label} total PNL</dt>
          <dd
            className={cn(
              'tabular-nums font-semibold tracking-tight',
              data.performance.totalPnlUsd != null && data.performance.totalPnlUsd >= 0
                ? 'text-emerald-300/90'
                : 'text-rose-300/90',
            )}
          >
            {data.performance.totalPnlUsd != null
              ? formatCompactUsd(data.performance.totalPnlUsd)
              : '—'}
          </dd>
        </div>
      </dl>

      <p className="mt-3 border-t border-white/[0.055] pt-2.5 text-[8.5px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
        Win / Loss distribution
      </p>
      <ul className="mt-1.5 space-y-0.5">
        {buckets.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-2 text-[10.5px]">
            <span className="flex items-center gap-2 text-fg-secondary">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  b.tone === 'bull' ? 'bg-emerald-400/70' : 'bg-rose-400/75',
                )}
              />
              {b.label}
            </span>
            <span className="tabular-nums text-fg-primary">{b.count}</span>
          </li>
        ))}
      </ul>

      <div className="mt-2.5 flex h-1 w-full overflow-hidden rounded-sm bg-white/[0.045]">
        {buckets.map((b) => (
          <div
            key={b.id}
            className={cn(b.tone === 'bull' ? 'bg-emerald-400/70' : 'bg-rose-400/80')}
            style={{ width: `${(b.count / total) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}
