'use client';

import {
  ArrowDown,
  ArrowUp,
  BarChart2,
  Clock,
  ExternalLink,
  Monitor,
  SlidersHorizontal,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { CopyButton } from '@/components/shared/CopyButton';
import type { TraderMintHoverStats } from '@/lib/trading/mintTopTraders';
import { formatAgeShort } from '@/lib/format';
import { formatCompactUsd } from '@/lib/utils/formatters';
import type { WalletTokenContextView } from '@/lib/walletIdentity/types';
import { explorerAddressUrl } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';

function formatWalletHeader(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}\u2026${address.slice(-4)}`;
}

function formatPnlUsd(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '\u2014';
  const formatted = formatCompactUsd(Math.abs(value));
  if (value > 0) return `+${formatted}`;
  if (value < 0) return `-${formatted}`;
  return formatted;
}

function txLabel(count: number, side: 'Buy' | 'Sell'): string {
  return `${count} ${side}${count === 1 ? '' : 's'}`;
}

type HeroStatProps = {
  icon: React.ReactNode;
  value: string;
  label: string;
  valueClass: string;
};

function HeroStat({ icon, value, label, valueClass }: HeroStatProps) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5">
      <div className="flex min-w-0 items-center gap-1">
        {icon}
        <span
          className={cn(
            'whitespace-nowrap text-[15px] font-semibold font-mono tabular-nums leading-none',
            valueClass,
          )}
        >
          {value}
        </span>
      </div>
      <span className="text-[10px] text-fg-muted">{label}</span>
    </div>
  );
}

type ActionIconProps = {
  label: string;
  onClick?: () => void;
  href?: string;
  children: React.ReactNode;
};

function ActionIcon({ label, onClick, href, children }: ActionIconProps) {
  const className =
    'inline-flex h-5 w-5 cursor-pointer items-center justify-center text-fg-muted transition-colors hover:text-fg-primary';

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer"
        className={className}
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </a>
    );
  }

  return (
    <button type="button" className={className} aria-label={label} onClick={onClick}>
      {children}
    </button>
  );
}

export function WalletCompactTooltipPanel({
  address,
  stats,
  tokenCtx,
  onOpenChart,
  onOpenSettings,
  onFilter,
}: {
  address: string;
  stats: TraderMintHoverStats | null | undefined;
  tokenCtx: WalletTokenContextView | null;
  onOpenChart?: () => void;
  onOpenSettings?: () => void;
  onFilter?: () => void;
}) {
  const buyUsd = stats?.buy_usd ?? tokenCtx?.boughtUsd ?? null;
  const sellUsd = stats?.sell_usd ?? tokenCtx?.soldUsd ?? null;
  const pnl = stats?.realized_pnl_usd ?? tokenCtx?.realizedPnlUsd ?? null;
  const buyCount = stats?.buy_count ?? (buyUsd != null && buyUsd > 0 ? 1 : 0);
  const sellCount = stats?.sell_count ?? (sellUsd != null && sellUsd > 0 ? 1 : 0);
  const txTotal = buyCount + sellCount;

  const remainingUsd = tokenCtx?.remainingUsd ?? 0;
  const remainingPct =
    tokenCtx?.remainingPct != null ? Math.round(tokenCtx.remainingPct) : 0;

  const holderSinceAt = tokenCtx?.firstBuyAt ?? stats?.first_trade_at ?? null;
  const holderSince = holderSinceAt ? formatAgeShort(holderSinceAt) : '\u2014';

  const pnlPositive = pnl != null && pnl >= 0;
  const explorerHref = explorerAddressUrl(address);

  return (
    <div className="wallet-compact-hover-panel z-50 w-[300px] overflow-hidden rounded-lg border border-white/[0.09] bg-bg-hover/95 p-0 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.62),inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/[0.06] px-3 pb-2 pt-2.5">
        <div className="flex min-w-0 items-center gap-1">
          <span className="truncate text-[11px] font-mono text-fg-secondary">
            {formatWalletHeader(address)}
          </span>
          <CopyButton
            value={address}
            iconOnly
            iconClassName="h-3 w-3 text-fg-muted hover:text-fg-primary"
          />
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <span className="rounded bg-bg-hover px-1.5 py-0.5 text-[10px] text-fg-muted">USD</span>
          {onOpenSettings ? (
            <button
              type="button"
              className="inline-flex h-5 w-5 cursor-pointer items-center justify-center text-fg-muted transition-colors hover:text-fg-primary"
              aria-label="Wallet settings"
              onClick={onOpenSettings}
            >
              <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 border-b border-white/[0.06] px-3 py-2.5">
        <HeroStat
          icon={<ArrowDown className="h-3.5 w-3.5 shrink-0 text-signal-bull" strokeWidth={2.5} />}
          value={buyUsd != null ? formatCompactUsd(buyUsd) : '\u2014'}
          label={txLabel(buyCount, 'Buy')}
          valueClass="text-signal-bull"
        />
        <HeroStat
          icon={<ArrowUp className="h-3.5 w-3.5 shrink-0 text-signal-bear" strokeWidth={2.5} />}
          value={sellUsd != null ? formatCompactUsd(sellUsd) : '\u2014'}
          label={txLabel(sellCount, 'Sell')}
          valueClass="text-signal-bear"
        />
        <HeroStat
          icon={
            pnlPositive ? (
              <TrendingUp className="h-3.5 w-3.5 shrink-0 text-signal-bull" strokeWidth={2.5} />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 shrink-0 text-signal-bear" strokeWidth={2.5} />
            )
          }
          value={formatPnlUsd(pnl)}
          label="PnL"
          valueClass={pnlPositive ? 'text-signal-bull' : 'text-signal-bear'}
        />
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-white/[0.06] px-3 py-2">
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <Monitor className="h-3.5 w-3.5 shrink-0 text-fg-muted" strokeWidth={2} />
            <span className="whitespace-nowrap text-[13px] font-mono tabular-nums text-fg-primary">
              {formatCompactUsd(remainingUsd)}
            </span>
          </div>
          <span className="text-[10px] text-fg-muted">
            {remainingPct}% ({txTotal})
          </span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <div className="flex items-center gap-1">
            <Clock className="h-3.5 w-3.5 shrink-0 text-fg-muted" strokeWidth={2} />
            <span className="whitespace-nowrap text-[13px] font-mono tabular-nums text-fg-primary">
              {holderSince}
            </span>
          </div>
          <span className="text-[10px] text-fg-muted">Holder Since</span>
        </div>
      </div>

      <div className="flex items-center gap-3 px-3 py-2">
        <ActionIcon label="Open wallet chart" onClick={onOpenChart}>
          <BarChart2 className="h-3.5 w-3.5" strokeWidth={2} />
        </ActionIcon>
        <ActionIcon label="Open in explorer" href={explorerHref}>
          <ExternalLink className="h-3.5 w-3.5" strokeWidth={2} />
        </ActionIcon>
        {onFilter ? (
          <ActionIcon label="Filter by address" onClick={onFilter}>
            <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={2} />
          </ActionIcon>
        ) : null}
      </div>
    </div>
  );
}
