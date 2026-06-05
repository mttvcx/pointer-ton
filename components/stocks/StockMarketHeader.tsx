'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { StockAvatar } from '@/components/stocks/StockAvatar';
import {
  formatStockFundingLabel,
  formatStockMark,
  formatStockOi,
  formatStockVol,
  STOCK_MAX_LEVERAGE,
  stockOraclePx,
  stockPriceDecimals,
} from '@/lib/stocks/stockPerpUi';
import type { SyntheticStockMarket } from '@/lib/stocks/types';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/formatters';

function Stat({
  label,
  value,
  sub,
  valueClass,
}: {
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0 shrink-0">
      <div className="text-[9px] font-medium tracking-wide text-fg-muted">{label}</div>
      <div className={cn('mt-0.5 truncate text-[11px] font-semibold tabular-nums', valueClass ?? 'text-fg-primary')}>
        {value}
      </div>
      {sub ? <div className="mt-px truncate text-[9px] tabular-nums text-fg-muted">{sub}</div> : null}
    </div>
  );
}

export function StockMarketHeader({ market }: { market: SyntheticStockMarket }) {
  const dec = stockPriceDecimals(market.priceUsd);
  const oracle = stockOraclePx(market);
  const funding = formatStockFundingLabel(market);
  const chg = market.change24hPct;

  return (
    <div className="shrink-0 border-b border-border-subtle bg-bg-raised">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-2 py-1.5">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href="/pulse"
            className="focus-ring inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
            aria-label="Back to Pulse stocks"
            title="Back to stocks"
          >
            <ChevronLeft className="h-4 w-4" strokeWidth={2} />
          </Link>
          <StockAvatar symbol={market.symbol} size={28} className="rounded-md" />
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold text-fg-primary">{market.symbol}</div>
            <div className="truncate text-[10px] text-fg-muted">{market.name}</div>
          </div>
        </div>

        <Stat label="Mark" value={formatStockMark(market)} />
        <Stat label="Oracle" value={formatNumber(oracle, { decimals: dec })} />
        <Stat
          label="24h"
          value={`${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`}
          valueClass={chg >= 0 ? 'text-signal-bull' : 'text-signal-bear'}
        />
        <Stat label="Funding" value={funding.hourly} sub={`${funding.apr} · 22m`} />
        <Stat label="Open interest" value={formatStockOi(market)} />
        <Stat label="24h volume" value={formatStockVol(market)} />
        <Stat label="Max lev" value={`${STOCK_MAX_LEVERAGE}x`} />
      </div>
    </div>
  );
}
