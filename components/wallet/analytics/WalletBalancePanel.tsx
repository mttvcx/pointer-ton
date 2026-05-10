'use client';

import { cn } from '@/lib/utils/cn';
import { formatCompactUsd } from '@/lib/utils/formatters';
import type { WalletAnalyticsPayload } from '@/lib/wallet-analytics/types';

export function WalletBalancePanel({
  data,
  currency,
}: {
  data: WalletAnalyticsPayload;
  currency: 'USD';
}) {
  const pos = (v: number | null | undefined) =>
    v == null || !Number.isFinite(v) ? 'default' : v >= 0 ? 'bull' : 'bear';

  return (
    <div className="flex min-h-0 flex-col rounded-xl border border-border-subtle/80 bg-bg-base/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.1em] text-fg-muted">Balance</h3>
        <span className="rounded-md border border-border-subtle bg-bg-base px-2 py-0.5 text-[10px] font-semibold text-fg-secondary">
          {currency}
        </span>
      </div>

      <dl className="mt-4 space-y-3 text-[12px]">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-fg-muted">Total Value</dt>
          <dd className="tabular-nums font-semibold text-fg-primary">
            {data.totalValueUsd != null ? formatCompactUsd(data.totalValueUsd) : '—'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-fg-muted">Unrealized PNL</dt>
          <dd
            className={cn(
              'tabular-nums font-semibold',
              pos(data.unrealizedPnlUsd) === 'bull' && 'text-signal-bull',
              pos(data.unrealizedPnlUsd) === 'bear' && 'text-signal-bear',
              pos(data.unrealizedPnlUsd) === 'default' && 'text-fg-secondary',
            )}
          >
            {data.unrealizedPnlUsd != null ? formatCompactUsd(data.unrealizedPnlUsd) : '—'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-fg-muted">Tradeable Balance</dt>
          <dd className="tabular-nums text-fg-primary">
            {data.chain === 'ton' && data.nativeBalanceLabel
              ? data.nativeBalanceLabel
              : data.tradeableBalanceUsd != null
                ? formatCompactUsd(data.tradeableBalanceUsd)
                : '—'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-fg-muted">Stable Coin Balance</dt>
          <dd className="tabular-nums text-fg-primary">
            {data.stableCoinBalanceUsd != null ? formatCompactUsd(data.stableCoinBalanceUsd) : '—'}
          </dd>
        </div>
      </dl>

      <div className="mt-5 rounded-lg border border-border-subtle/60 bg-black/20 px-3 py-2.5">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
          Wallet Funding
        </p>
        <div className="mt-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="rounded border border-white/10 bg-white/[0.04] px-1.5 py-0.5 text-[10px] font-bold text-accent-primary">
              {data.chain === 'sol' ? 'SOL' : data.chain.toUpperCase()}
            </span>
            <span className="text-[11px] text-fg-secondary">
              {data.chain === 'sol' ? 'Solana' : data.chain.toUpperCase()}
            </span>
          </div>
          <span className="text-[11px] tabular-nums text-fg-muted">
            {data.walletAgeLabel ?? '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
