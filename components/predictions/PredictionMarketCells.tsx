'use client';

import Link from 'next/link';
import { Star } from 'lucide-react';
import type { PredictionMarket } from '@/lib/predictions/marketsDemo';
import { PredictionMarketIcon } from '@/components/predictions/PredictionMarketIcon';
import { PredictionSparkline } from '@/components/predictions/PredictionSparkline';
import { formatPredictionChange, formatPredictionUsd } from '@/components/predictions/formatPrediction';
import { cn } from '@/lib/utils/cn';

export type PredictionQuickTradeHandler = (
  market: PredictionMarket,
  outcome: 'yes' | 'no',
) => void;

const CARD_SHELL =
  'flex flex-col rounded-lg border border-border-subtle bg-bg-hover/35 p-3 transition hover:border-white/12 hover:bg-bg-hover/50';

function YesNoButtons({
  market,
  onQuickTrade,
  size = 'md',
}: {
  market: PredictionMarket;
  onQuickTrade: PredictionQuickTradeHandler;
  size?: 'md' | 'lg';
}) {
  const py = size === 'lg' ? 'py-2' : 'py-1.5';
  const text = size === 'lg' ? 'text-[12px]' : 'text-[11px]';

  return (
    <div className="grid grid-cols-2 gap-2">
      <button
        type="button"
        onClick={() => onQuickTrade(market, 'yes')}
        className={cn(
          'btn-press rounded-sm bg-signal-bull/12 text-center font-semibold text-signal-bull ring-1 ring-signal-bull/25 hover:bg-signal-bull/20',
          py,
          text,
        )}
      >
        Yes {market.yesPriceCents}¢
      </button>
      <button
        type="button"
        onClick={() => onQuickTrade(market, 'no')}
        className={cn(
          'btn-press rounded-sm bg-signal-bear/10 text-center font-semibold text-signal-bear ring-1 ring-signal-bear/20 hover:bg-signal-bear/16',
          py,
          text,
        )}
      >
        No {market.noPriceCents}¢
      </button>
    </div>
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
        <Link
          href={`/predictions/${market.id}`}
          className="flex min-w-0 items-start gap-2.5"
        >
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
      <td className="hidden px-2 py-2 text-right font-mono text-[11px] tabular-nums text-fg-secondary lg:table-cell">
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
        <button
          type="button"
          onClick={() => onQuickTrade(market, 'yes')}
          className="btn-press inline-flex h-7 items-center rounded-sm bg-signal-bull/15 px-3 text-[11px] font-semibold text-signal-bull ring-1 ring-signal-bull/25 transition hover:bg-signal-bull/25"
        >
          Buy
        </button>
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
    <div className={CARD_SHELL}>
      <div className="mb-2 flex items-start justify-between gap-2">
        <PredictionMarketIcon market={market} />
        <button
          type="button"
          className="text-fg-muted transition hover:text-signal-warn"
          aria-label="Watchlist"
        >
          <Star className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>
      <Link href={`/predictions/${market.id}`} className="block min-w-0 hover:underline">
        <p className="line-clamp-2 min-h-[2.5rem] text-[12px] font-medium leading-snug text-fg-primary">
          {market.title}
        </p>
      </Link>
      <p className="mt-1 text-[11px] text-fg-muted">{market.outcomeLabel}</p>
      <div className="mt-3 flex items-end justify-between">
        <span className="font-mono text-2xl font-semibold tabular-nums text-fg-primary">
          {market.yesPct}%
        </span>
        <PredictionSparkline values={market.spark} width={64} height={24} />
      </div>
      <div className="mt-3">
        <YesNoButtons market={market} onQuickTrade={onQuickTrade} />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-3 text-[10px] tabular-nums text-fg-muted">
        <span>Vol {formatPredictionUsd(market.volumeUsd)}</span>
        <span>Liq {formatPredictionUsd(market.liquidityUsd)}</span>
        <span>{market.endsIn}</span>
      </div>
    </div>
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
    <div className={cn(CARD_SHELL, 'min-w-[280px] flex-1 p-4')}>
      <div className="mb-2">
        <PredictionMarketIcon market={market} size="lg" />
      </div>
      <Link href={`/predictions/${market.id}`} className="block hover:underline">
        <p className="text-[13px] font-semibold leading-snug text-fg-primary">{market.title}</p>
      </Link>
      <p className="mt-1 text-[12px] text-fg-muted">{market.outcomeLabel}</p>
      <div className="mt-4 flex items-end justify-between gap-3">
        <span className="font-mono text-3xl font-bold tabular-nums">{market.yesPct}%</span>
        <PredictionSparkline values={market.spark} width={80} height={28} />
      </div>
      <div className="mt-3">
        <YesNoButtons market={market} onQuickTrade={onQuickTrade} size="lg" />
      </div>
      <div className="mt-3 flex gap-4 text-[10px] tabular-nums text-fg-muted">
        <span>Vol {formatPredictionUsd(market.volumeUsd)}</span>
        <span>Liq {formatPredictionUsd(market.liquidityUsd)}</span>
      </div>
    </div>
  );
}
