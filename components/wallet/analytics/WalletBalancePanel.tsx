'use client';

import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { explorerUrlSolanaTx } from '@/lib/chains/explorerUrls';
import { CHAIN_ICON_PNG, CHAIN_TICKER } from '@/lib/chains/chainAssets';
import { formatCompactUsd, formatNumber } from '@/lib/utils/formatters';
import { shortenAddress } from '@/lib/utils/addresses';
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
  const chainTicker = CHAIN_TICKER[data.chain];
  const funding = data.funding;
  const fundingHref =
    data.chain === 'sol' && funding?.fundingTxSignature
      ? explorerUrlSolanaTx(funding.fundingTxSignature)
      : data.chain === 'sol' && funding?.fromAddress
        ? `https://solscan.io/account/${encodeURIComponent(funding.fromAddress)}`
        : null;

  return (
    <div className="flex min-h-0 flex-col p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-fg-primary">BALANCE</h3>
        <span className="rounded border border-border-subtle bg-bg-sunken px-1.5 py-0.5 text-[8.5px] font-semibold uppercase tracking-wide text-fg-muted">
          {currency}
        </span>
      </div>

      <dl className="space-y-2 text-xs">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-fg-muted">Total value</dt>
          <dd className="text-2xl font-bold tabular-nums text-fg-primary">
            {data.totalValueUsd != null ? formatCompactUsd(data.totalValueUsd) : '—'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-fg-muted">Unrealized PNL</dt>
          <dd
            className={cn(
              'text-lg font-semibold tabular-nums',
              pos(data.unrealizedPnlUsd) === 'bull' && 'text-signal-bull',
              pos(data.unrealizedPnlUsd) === 'bear' && 'text-signal-bear',
              pos(data.unrealizedPnlUsd) === 'default' && 'text-fg-muted',
            )}
          >
            {data.unrealizedPnlUsd != null ? formatCompactUsd(data.unrealizedPnlUsd) : '—'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-fg-muted">Current balance</dt>
          <dd className="text-sm font-medium tabular-nums text-fg-primary">
            {data.chain === 'ton' && data.nativeBalanceLabel
              ? data.nativeBalanceLabel
              : data.tradeableBalanceUsd != null
                ? formatCompactUsd(data.tradeableBalanceUsd)
                : '—'}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-fg-muted">Stable balance</dt>
          <dd className="text-sm font-medium tabular-nums text-fg-primary">
            {data.stableCoinBalanceUsd != null ? formatCompactUsd(data.stableCoinBalanceUsd) : '—'}
          </dd>
        </div>
      </dl>

      <div className="mt-3 border-t border-border-subtle pt-2.5">
        <p className="text-[10px] uppercase tracking-wider text-fg-muted">Funded</p>
        {funding && data.chain === 'sol' ? (
          <div className="mt-1.5 space-y-1">
            <div className="flex items-center justify-between gap-2">
              <a
                href={fundingHref ?? undefined}
                target="_blank"
                rel="noreferrer"
                className={cn(
                  'group inline-flex min-w-0 items-center gap-1.5 text-[11px] font-medium',
                  fundingHref ? 'text-signal-info hover:underline' : 'cursor-default text-fg-secondary',
                )}
                title={
                  funding?.fundingTxSignature
                    ? 'Open funding transaction on Solscan'
                    : 'View funder on Solscan'
                }
                onClick={(e) => {
                  if (!fundingHref) e.preventDefault();
                }}
              >
                <span className="truncate font-mono tabular-nums">{shortenAddress(funding.fromAddress, 5)}</span>
                {fundingHref ? (
                  <ExternalLink className="h-3 w-3 shrink-0 opacity-70 group-hover:opacity-100" strokeWidth={2} />
                ) : null}
              </a>
            </div>
            <div className="flex items-center gap-1.5 text-xs tabular-nums text-fg-secondary">
              <span>{funding.periodLabel ?? '—'}</span>
              <span className="text-fg-muted/60">•</span>
              <span className="inline-flex items-center gap-0.5 font-medium text-fg-secondary">
                <img
                  src={CHAIN_ICON_PNG.sol}
                  alt=""
                  width={12}
                  height={12}
                  className="h-3 w-3 object-contain"
                  draggable={false}
                />
                {funding.amountSol != null
                  ? `${formatNumber(funding.amountSol, { decimals: 3 })} ${chainTicker}`
                  : '—'}
              </span>
            </div>
          </div>
        ) : (
          <p className="mt-1.5 text-[10.5px] text-fg-muted">
            No inbound SOL funding detected in recent transactions.
          </p>
        )}
      </div>
    </div>
  );
}
