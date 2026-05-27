'use client';

import { ExternalLink } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { explorerUrlSolanaTx } from '@/lib/chains/explorerUrls';
import { CHAIN_ICON_PNG, CHAIN_TICKER } from '@/lib/chains/chainAssets';
import { formatNumber } from '@/lib/utils/formatters';
import { shortenAddress } from '@/lib/utils/addresses';
import { formatWalletMoney } from '@/lib/wallet-analytics/displayCurrency';
import type { WalletAnalyticsPayload } from '@/lib/wallet-analytics/types';
import { WalletCurrencyToggle } from '@/components/wallet/analytics/WalletCurrencyToggle';

export function WalletBalancePanel({
  data,
  usdMode,
  onToggleCurrency,
}: {
  data: WalletAnalyticsPayload;
  usdMode: boolean;
  onToggleCurrency: () => void;
}) {
  const pos = (v: number | null | undefined) =>
    v == null || !Number.isFinite(v) ? 'default' : v >= 0 ? 'bull' : 'bear';
  const chainTicker = CHAIN_TICKER[data.chain];
  const funding = data.funding;
  const fmt = (usd: number | null | undefined, compact = true) =>
    formatWalletMoney(usd, {
      usdMode,
      solUsd: data.solUsd,
      nativeSym: chainTicker,
      compact,
    });
  const fundingHref =
    data.chain === 'sol' && funding?.fundingTxSignature
      ? explorerUrlSolanaTx(funding.fundingTxSignature)
      : data.chain === 'sol' && funding?.fromAddress
        ? `https://solscan.io/account/${encodeURIComponent(funding.fromAddress)}`
        : null;

  return (
    <div className="flex min-h-0 flex-col p-3">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-fg-primary">Balance</h3>
        <WalletCurrencyToggle usdMode={usdMode} nativeSym={chainTicker} onToggle={onToggleCurrency} />
      </div>

      <dl className="space-y-2 text-xs">
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-fg-muted">Total value</dt>
          <dd className="font-sans text-2xl font-semibold tabular-nums text-fg-primary">
            {fmt(data.totalValueUsd)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-fg-muted">Unrealized PNL</dt>
          <dd
            className={cn(
              'font-sans text-lg font-medium tabular-nums',
              pos(data.unrealizedPnlUsd) === 'bull' && 'text-signal-bull',
              pos(data.unrealizedPnlUsd) === 'bear' && 'text-signal-bear',
              pos(data.unrealizedPnlUsd) === 'default' && 'text-fg-muted',
            )}
          >
            {fmt(data.unrealizedPnlUsd)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-fg-muted">Current balance</dt>
          <dd className="font-sans text-sm font-medium tabular-nums text-fg-primary">
            {data.chain === 'ton' && data.nativeBalanceLabel
              ? data.nativeBalanceLabel
              : fmt(data.tradeableBalanceUsd)}
          </dd>
        </div>
        <div className="flex items-baseline justify-between gap-2">
          <dt className="text-fg-muted">Stable balance</dt>
          <dd className="font-sans text-sm font-medium tabular-nums text-fg-primary">
            {fmt(data.stableCoinBalanceUsd)}
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
                <span className="truncate font-sans text-[11px] font-medium tabular-nums">{shortenAddress(funding.fromAddress, 5)}</span>
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
