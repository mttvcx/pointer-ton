'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Star } from 'lucide-react';
import type { PredictionMarket } from '@/lib/predictions/types';
import { PredictionMarketIcon } from '@/components/predictions/PredictionMarketIcon';
import { PredictionSparkline } from '@/components/predictions/PredictionSparkline';
import { MarketStatsFooter } from '@/components/predictions/MarketStatsFooter';
import {
  ActiveBuyStrip,
  ChanceReadout,
  YesNoTradeButtons,
  type PredictionQuickTradeHandler,
} from '@/components/predictions/YesNoTradeButtons';
import { formatPredictionChange, formatPredictionUsd } from '@/components/predictions/formatPrediction';
import { cn } from '@/lib/utils/cn';

export type { PredictionQuickTradeHandler };

const CARD_SHELL =
  'pred-market-card group/card relative flex flex-col rounded-lg border border-border-subtle/60 bg-bg-hover/35 p-3 transition-all duration-200';

function CardShell({
  market,
  children,
  className,
  featured,
}: {
  market: PredictionMarket;
  children: ReactNode;
  className?: string;
  featured?: boolean;
}) {
  const router = useRouter();
  const open = () => router.push(`/predictions/${encodeURIComponent(market.id)}`);

  return (
    <article
      className={cn(
        CARD_SHELL,
        'cursor-pointer',
        featured && 'pred-hero-card',
        'hover:border-accent-primary/35 hover:bg-bg-hover/50 hover:shadow-[0_0_0_1px_rgb(var(--accent-primary-rgb)/0.18),0_0_20px_rgb(var(--accent-primary-rgb)/0.08)]',
        className,
      )}
      role="link"
      tabIndex={0}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
      aria-label={`Open ${market.title}`}
    >
      {children}
    </article>
  );
}

export function PredictionsTableRow({
  market,
  onQuickTrade,
}: {
  market: PredictionMarket;
  onQuickTrade: PredictionQuickTradeHandler;
}) {
  const up = market.changePct24h >= 0;
  return (
    <tr className="group border-b border-border-subtle/30 transition-colors hover:bg-bg-hover/35">
      <td className="px-3 py-2">
        <Link href={`/predictions/${market.id}`} className="flex min-w-0 items-start gap-2.5">
          <PredictionMarketIcon market={market} />
          <div className="min-w-0">
            <p className="truncate text-[12px] font-medium text-fg-primary">{market.title}</p>
            <p className="mt-0.5 text-[11px] font-medium text-signal-bull">{market.outcomeLabel}</p>
          </div>
        </Link>
      </td>
      <td className="px-2 py-2">
        <div className="flex items-center gap-2">
          <PredictionSparkline values={market.spark} />
          <div className="tabular-nums">
            <div className="text-[13px] font-semibold text-fg-primary">{market.yesPct}%</div>
            <div
              className={cn(
                'text-[10px] font-medium',
                up ? 'text-signal-bull' : 'text-signal-bear',
              )}
            >
              {formatPredictionChange(market.changePct24h)}
            </div>
          </div>
        </div>
      </td>
      <td className="hidden px-2 py-2 text-right font-mono text-[11px] tabular-nums text-accent-primary lg:table-cell">
        {formatPredictionUsd(market.volumeUsd)}
      </td>
      <td className="hidden px-2 py-2 text-right font-mono text-[11px] tabular-nums text-fg-secondary md:table-cell">
        {formatPredictionUsd(market.liquidityUsd)}
      </td>
      <td className="hidden px-2 py-2 text-right xl:table-cell">
        <div className="font-mono text-[11px] tabular-nums text-fg-secondary">{market.txns}</div>
        <div className="text-[10px] tabular-nums">
          <span className="text-signal-bull">{market.txnBuys}</span>
          <span className="text-fg-muted"> / </span>
          <span className="text-signal-bear">{market.txnSells}</span>
        </div>
      </td>
      <td className="hidden px-2 py-2 text-right font-mono text-[11px] tabular-nums text-fg-secondary lg:table-cell">
        {market.traders}
      </td>
      <td className="px-2 py-2 text-right font-mono text-[11px] tabular-nums text-fg-muted">
        {market.endsIn}
      </td>
      <td className="px-3 py-2 text-right">
        <div className="pointer-events-auto inline-flex gap-1">
          <button
            type="button"
            onClick={() => onQuickTrade(market, 'yes')}
            className="btn-press inline-flex h-7 items-center rounded-sm bg-signal-bull/18 px-2.5 text-[10px] font-semibold text-signal-bull ring-1 ring-signal-bull/28 hover:bg-signal-bull/28"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onQuickTrade(market, 'no')}
            className="btn-press inline-flex h-7 items-center rounded-sm bg-signal-bear/14 px-2.5 text-[10px] font-semibold text-signal-bear ring-1 ring-signal-bear/24 hover:bg-signal-bear/22"
          >
            No
          </button>
        </div>
      </td>
    </tr>
  );
}

export function PredictionMarketCard({
  market,
  onQuickTrade,
}: {
  market: PredictionMarket;
  onQuickTrade: PredictionQuickTradeHandler;
}) {
  return (
    <CardShell market={market}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <PredictionMarketIcon market={market} />
        <button
          type="button"
          className="text-fg-muted transition hover:text-signal-warn"
          aria-label="Watchlist"
          onClick={(e) => e.stopPropagation()}
        >
          <Star className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
      <p className="line-clamp-2 min-h-[2.5rem] text-[12px] font-medium leading-snug text-fg-primary">
        {market.title}
      </p>
      <p className="mt-1 text-[11px] text-fg-muted">{market.outcomeLabel}</p>
      <div className="mt-3 flex items-end justify-between">
        <ChanceReadout market={market} />
        <PredictionSparkline values={market.spark} width={64} height={24} />
      </div>
      <div className="mt-3" onClick={(e) => e.stopPropagation()}>
        <YesNoTradeButtons market={market} onQuickTrade={onQuickTrade} />
      </div>
      <ActiveBuyStrip trades={market.recentTrades} className="mt-2" />
      <MarketStatsFooter
        volumeUsd={market.volumeUsd}
        liquidityUsd={market.liquidityUsd}
        endsIn={market.endsIn}
        closeTime={market.closeTime}
        className="mt-3"
      />
    </CardShell>
  );
}

export function PredictionsFeaturedCard({
  market,
  onQuickTrade,
}: {
  market: PredictionMarket;
  onQuickTrade: PredictionQuickTradeHandler;
}) {
  return (
    <CardShell market={market} className="min-w-[280px] flex-1 p-4" featured>
      <div className="mb-2">
        <PredictionMarketIcon market={market} size="lg" />
      </div>
      <p className="text-[13px] font-semibold leading-snug text-fg-primary">{market.title}</p>
      <p className="mt-1 text-[12px] text-fg-muted">{market.outcomeLabel}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <ChanceReadout market={market} />
        <PredictionSparkline values={market.spark} width={80} height={28} />
      </div>
      <div className="pointer-events-auto mt-3">
        <YesNoTradeButtons market={market} onQuickTrade={onQuickTrade} size="lg" />
      </div>
      <ActiveBuyStrip trades={market.recentTrades} className="mt-2" />
      <MarketStatsFooter
        volumeUsd={market.volumeUsd}
        liquidityUsd={market.liquidityUsd}
        endsIn={market.endsIn}
        closeTime={market.closeTime}
        className="mt-3"
      />
    </CardShell>
  );
}
