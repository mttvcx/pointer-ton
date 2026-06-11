'use client';

import { cn } from '@/lib/utils/cn';
import { formatWalletMoney } from '@/lib/wallet-analytics/displayCurrency';
import { CHAIN_TICKER } from '@/lib/chains/chainAssets';
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
  usdMode,
}: {
  data: WalletAnalyticsPayload;
  timeframe: WalletAnalyticsTimeframe;
  usdMode: boolean;
}) {
  const label = tfLabel(timeframe);
  const chainTicker = CHAIN_TICKER[data.chain];
  const fmt = (usd: number | null | undefined) =>
    formatWalletMoney(usd, { usdMode, solUsd: data.solUsd, nativeSym: chainTicker });  const buckets = data.buckets;
  const total = buckets.reduce((s, b) => s + b.count, 0) || 1;

  const tx = data.performance.txns;
  const wr = data.performance.winRatePct;
  const wins = tx != null && wr != null ? Math.round((tx * wr) / 100) : null;
  const losses = tx != null && wins != null ? Math.max(0, tx - wins) : null;
  const coinsTraded = data.positions.length;

  const realizedUsd = data.performance.realizedPnlUsd;
  const totalUsd = data.performance.totalPnlUsd;

  return (
    <div className="flex min-h-0 flex-col p-3">
      <h3 className="mb-3 text-xs font-semibold text-fg-primary">Performance</h3>

      <dl className="space-y-1.5 text-xs">
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">{label} realized PNL</dt>
          <dd
            className={cn(
              'text-right font-sans font-medium tabular-nums',
              realizedUsd == null && 'text-fg-muted',
              realizedUsd != null && realizedUsd > 0 && 'text-signal-bull',
              realizedUsd != null && realizedUsd < 0 && 'text-signal-bear',
              realizedUsd === 0 && 'text-fg-primary',
            )}
          >
            {realizedUsd != null ? fmt(realizedUsd) : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">TXNS</dt>
          <dd className="text-right font-sans font-medium tabular-nums text-fg-primary">
            {tx != null ? (
              <>
                {tx}
                {wins != null && losses != null ? (
                  <span className="text-fg-muted">
                    {' ('}
                    <span className="font-medium text-signal-bull">{wins}</span>
                    {'/'}
                    <span className="font-medium text-signal-bear">{losses}</span>
                    {')'}
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
          <dd className="text-right font-sans font-medium tabular-nums text-fg-primary">{coinsTraded}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">Wins</dt>
          <dd className="text-right font-sans font-medium tabular-nums text-signal-bull">{wins != null ? wins : '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">Losses</dt>
          <dd className="text-right font-sans font-medium tabular-nums text-signal-bear">{losses != null ? losses : '—'}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">Win rate</dt>
          <dd
            className={cn(
              'text-right font-sans tabular-nums',
              wr == null && 'font-medium text-fg-muted',
              wr != null && 'font-medium',
              wr != null && wr >= 50 && 'text-signal-bull',
              wr != null && wr < 50 && 'text-signal-bear',
            )}
          >
            {wr != null ? `${wr.toFixed(1)}%` : '—'}
          </dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-fg-muted">{label} total PNL</dt>
          <dd
            className={cn(
              'text-right font-sans font-medium tabular-nums',
              totalUsd == null && 'text-fg-muted',
              totalUsd != null && totalUsd > 0 && 'text-signal-bull',
              totalUsd != null && totalUsd < 0 && 'text-signal-bear',
              totalUsd === 0 && 'text-fg-primary',
            )}
          >
            {totalUsd != null ? fmt(totalUsd) : '—'}
          </dd>
        </div>
      </dl>

      <p className="mt-3 border-t border-border-subtle pt-2.5 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">
        Win / Loss distribution
      </p>
      {buckets.length === 0 ? (
        <p className="mt-1.5 text-[11px] text-fg-muted">
          No trade stats indexed for this wallet yet.
        </p>
      ) : null}
      <ul className="mt-1.5 space-y-0.5">
        {buckets.map((b) => (
          <li key={b.id} className="flex items-center justify-between gap-2 text-xs">
            <span className="flex items-center text-fg-secondary">
              <span
                className={cn(
                  'mr-1.5 h-2 w-2 shrink-0 rounded-full',
                  b.tone === 'bull' ? 'bg-emerald-400/80' : 'bg-rose-400/80',
                )}
              />
              {b.label}
            </span>
            <span className="tabular-nums text-fg-primary">{b.count}</span>
          </li>
        ))}
      </ul>

      <div className="mt-2.5 flex h-1 w-full overflow-hidden rounded-full bg-white/[0.045]">
        {buckets.map((b) => (
          <div
            key={b.id}
            className={cn(b.tone === 'bull' ? 'bg-emerald-400/80' : 'bg-rose-400/80')}
            style={{ width: `${(b.count / total) * 100}%` }}
          />
        ))}
      </div>
    </div>
  );
}
