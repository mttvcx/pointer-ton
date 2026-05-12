'use client';

import type { TraderMintHoverStats } from '@/lib/trading/mintTopTraders';
import { formatNumber, formatRelativeTime } from '@/lib/utils/formatters';
import type { WalletTokenContextView } from '@/lib/walletIdentity/types';
import { cn } from '@/lib/utils/cn';
import type { MockWideStatsShape } from '@/lib/walletIdentity/mockWalletWideStats';

function Cell({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[8px] font-medium tracking-tight text-fg-muted">{label}</div>
      <div className={cn('mt-px truncate text-[10px] font-semibold tabular-nums tracking-tight', valueClass)}>
        {value}
      </div>
    </div>
  );
}

export function WalletCompactTooltipPanel({
  stats,
  wide,
  tokenCtx,
}: {
  stats: TraderMintHoverStats | null | undefined;
  wide: MockWideStatsShape;
  tokenCtx: WalletTokenContextView | null;
}) {
  const buy = stats?.buy_usd;
  const sell = stats?.sell_usd;
  const pnl = stats?.realized_pnl_usd ?? tokenCtx?.realizedPnlUsd;
  const pnlCls =
    pnl == null ? 'text-fg-secondary' : pnl >= 0 ? 'text-signal-bull' : 'text-signal-bear';
  const feesUsd = stats ? Math.max(0, wide.totalFeesUsd * 0.12) : 0;

  return (
    <div className="w-[min(19rem,calc(100vw-24px))] rounded-lg border border-white/[0.1] bg-[#070a10]/[0.98] p-2.5 text-fg-primary shadow-xl backdrop-blur-md">
      <div className="grid grid-cols-3 gap-2 border-b border-white/[0.06] pb-2">
        <Cell
          label="Bought"
          value={buy != null ? `$${formatNumber(buy, { decimals: 1 })}` : '—'}
          valueClass="text-signal-bull"
        />
        <Cell
          label="Sold"
          value={sell != null ? `$${formatNumber(sell, { decimals: 1 })}` : '—'}
          valueClass="text-signal-bear"
        />
        <Cell label="Fees" value={`$${formatNumber(feesUsd, { decimals: 2 })}`} />
      </div>
      <div className="grid grid-cols-3 gap-2 border-b border-white/[0.06] py-2">
        <Cell
          label={`PnL (${tokenCtx?.tokenSymbol ?? 'mint'})`}
          value={
            pnl != null
              ? `${pnl >= 0 ? '+' : ''}$${formatNumber(pnl, { decimals: 1 })}`
              : '—'
          }
          valueClass={pnlCls}
        />
        <Cell
          label="Remaining"
          value={
            tokenCtx?.remainingUsd != null
              ? `$${formatNumber(tokenCtx.remainingUsd, { decimals: 0 })}`
              : '—'
          }
        />
        <Cell label="Desk age est." value={wide.walletAgeDays != null ? `${wide.walletAgeDays}d` : '—'} />
      </div>
      <div className="grid grid-cols-4 gap-x-2 gap-y-2 pt-2">
        <Cell label="Tracked" value={`${wide.trackedByCount}`} />
        <Cell label="Renamed" value={`${wide.renamedByCount}`} />
        <Cell label="7D win %" value={`${formatNumber(wide.winRate7d, { decimals: 0 })}%`} />
        <Cell
          label="7D PnL"
          value={`${wide.pnl7dUsd >= 0 ? '+' : ''}$${formatNumber(wide.pnl7dUsd, { decimals: 0 })}`}
          valueClass={wide.pnl7dUsd >= 0 ? 'text-signal-bull' : 'text-signal-bear'}
        />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-x-2 gap-y-2 border-t border-white/[0.05] pt-2">
        <Cell
          label="7D TXs"
          value={`${wide.txBuy7d}b/${wide.txSell7d}s`}
          valueClass="text-[9px] text-fg-secondary"
        />
        <Cell label="7D tokens" value={`${wide.tokenCount7d}`} />
        <Cell label="Avg hold" value={`${formatNumber(wide.avgDuration7dHours, { decimals: 0 })}h`} />
        <Cell label="Last" value={tokenCtx?.lastActionAt ? formatRelativeTime(tokenCtx.lastActionAt) : '—'} />
      </div>
      <p className="mt-2 text-[8px] leading-snug tracking-tight text-fg-muted/90">
        Est. wallet rollup (demo) · Hover slice pulls this mint from Pointer fills when wired.
      </p>
    </div>
  );
}
