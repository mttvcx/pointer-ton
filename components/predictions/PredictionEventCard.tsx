'use client';

import { useRouter } from 'next/navigation';
import { ChevronDown, Star } from 'lucide-react';
import type { PredictionMarket } from '@/lib/predictions/types';
import {
  aggregateEventStats,
  type PredictionCardItem,
} from '@/lib/predictions/groupMarkets';
import { PredictionMarketIcon } from '@/components/predictions/PredictionMarketIcon';
import { PredictionSparkline } from '@/components/predictions/PredictionSparkline';
import { MarketStatsFooter } from '@/components/predictions/MarketStatsFooter';
import {
  ActiveBuyStrip,
  ChanceReadout,
  YesNoTradeButtons,
  type PredictionQuickTradeHandler,
} from '@/components/predictions/YesNoTradeButtons';
const CARD_SHELL =
  'pred-market-card group/card relative flex cursor-pointer flex-col rounded-lg border border-border-subtle/60 bg-bg-hover/35 p-3 transition-all duration-200 hover:border-accent-primary/35 hover:bg-bg-hover/50 hover:shadow-[0_0_0_1px_rgb(var(--accent-primary-rgb)/0.18),0_0_20px_rgb(var(--accent-primary-rgb)/0.08)]';

function OutcomeRow({
  market,
  onQuickTrade,
}: {
  market: PredictionMarket;
  onQuickTrade: PredictionQuickTradeHandler;
}) {
  return (
    <div className="flex shrink-0 items-center gap-2 border-b border-border-subtle/25 py-1.5 last:border-b-0">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[11px] font-medium text-fg-primary">{market.outcomeLabel}</p>
        <p className="font-mono text-[10px] tabular-nums text-fg-muted">{market.yesPct}%</p>
      </div>
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={() => onQuickTrade(market, 'yes')}
          className="btn-press rounded-sm bg-signal-bull/18 px-2 py-1 text-[9px] font-semibold tabular-nums text-signal-bull ring-1 ring-signal-bull/28 hover:bg-signal-bull/28"
        >
          Yes {market.yesPriceCents}¢
        </button>
        <button
          type="button"
          onClick={() => onQuickTrade(market, 'no')}
          className="btn-press rounded-sm bg-signal-bear/14 px-2 py-1 text-[9px] font-semibold tabular-nums text-signal-bear ring-1 ring-signal-bear/24 hover:bg-signal-bear/22"
        >
          No {market.noPriceCents}¢
        </button>
      </div>
    </div>
  );
}

export function PredictionEventCard({
  eventId,
  title,
  markets,
  onQuickTrade,
}: {
  eventId: string;
  title: string;
  markets: PredictionMarket[];
  onQuickTrade: PredictionQuickTradeHandler;
}) {
  const router = useRouter();
  const primary = markets[0]!;
  const stats = aggregateEventStats(markets);
  const visible = markets.slice(0, 8);
  const more = markets.length - visible.length;

  const openEvent = () => router.push(`/predictions/${encodeURIComponent(eventId)}`);

  return (
    <article
      className={CARD_SHELL}
      role="link"
      tabIndex={0}
      onClick={openEvent}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          openEvent();
        }
      }}
      aria-label={`Open ${title}`}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <PredictionMarketIcon market={primary} />
        <button
          type="button"
          className="text-fg-muted transition hover:text-signal-warn"
          aria-label="Watchlist"
          onClick={(e) => e.stopPropagation()}
        >
          <Star className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
      </div>

      <p className="line-clamp-2 min-h-[2.25rem] text-[12px] font-medium leading-snug text-fg-primary">
        {title}
      </p>

      <div
        className="pred-outcome-scroll mt-2.5 rounded-md border border-border-subtle/40 bg-bg-sunken/40 px-2"
        onClick={(e) => e.stopPropagation()}
      >
        {visible.map((m) => (
          <OutcomeRow key={m.id} market={m} onQuickTrade={onQuickTrade} />
        ))}
      </div>

      {more > 0 ? (
        <button
          type="button"
          className="mt-1.5 inline-flex items-center gap-0.5 text-[10px] font-medium text-accent-primary hover:underline"
          onClick={(e) => {
            e.stopPropagation();
            openEvent();
          }}
        >
          <ChevronDown className="h-3 w-3" />
          {markets.length} markets
        </button>
      ) : null}

      <ActiveBuyStrip trades={stats.recentTrades} className="mt-2" />
      <MarketStatsFooter
        volumeUsd={stats.volumeUsd}
        liquidityUsd={stats.liquidityUsd}
        endsIn={stats.endsIn}
        closeTime={stats.closeTime}
        className="mt-3"
      />
    </article>
  );
}

function SingleMarketCard({
  market,
  onQuickTrade,
}: {
  market: PredictionMarket;
  onQuickTrade: PredictionQuickTradeHandler;
}) {
  const router = useRouter();
  const open = () => router.push(`/predictions/${encodeURIComponent(market.id)}`);

  return (
    <article
      className={CARD_SHELL}
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
    </article>
  );
}

export function PredictionCardGridItem({
  item,
  onQuickTrade,
}: {
  item: PredictionCardItem;
  onQuickTrade: PredictionQuickTradeHandler;
}) {
  if (item.kind === 'event' && item.markets.length > 1) {
    return (
      <PredictionEventCard
        eventId={item.id}
        title={item.title}
        markets={item.markets}
        onQuickTrade={onQuickTrade}
      />
    );
  }
  const market = item.kind === 'event' ? item.markets[0]! : item.market;
  return <SingleMarketCard market={market} onQuickTrade={onQuickTrade} />;
}
