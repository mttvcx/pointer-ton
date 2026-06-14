'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Pause } from 'lucide-react';
import type { PredictionAlphaItem, PredictionMarket } from '@/lib/predictions/types';
import { PredictionMarketIcon } from '@/components/predictions/PredictionMarketIcon';
import { PredictionSparkline } from '@/components/predictions/PredictionSparkline';
import { MarketStatsFooter } from '@/components/predictions/MarketStatsFooter';
import {
  ActiveBuyStrip,
  ChanceReadout,
  YesNoTradeButtons,
} from '@/components/predictions/YesNoTradeButtons';
import type { PredictionQuickTradeHandler } from '@/components/predictions/YesNoTradeButtons';
import { KalshiWordmark } from '@/components/predictions/KalshiWordmark';
import { cn } from '@/lib/utils/cn';

function relatedFeedItems(
  market: PredictionMarket,
  allMarkets: PredictionMarket[],
): PredictionAlphaItem[] {
  const related = allMarkets
    .filter(
      (m) =>
        m.id !== market.id &&
        (m.category === market.category ||
          m.tags.some((t) => market.tags.includes(t)) ||
          m.title.toLowerCase().includes(market.title.split(' ')[0]?.toLowerCase() ?? '')),
    )
    .slice(0, 4)
    .map((m) => ({
      id: `m-${m.id}`,
      title: m.title,
      url: `/predictions/${m.id}`,
      source: 'Kalshi',
      ago: m.endsIn,
      kind: 'analysis' as const,
    }));

  return [...(market.alphaFeed ?? []), ...related].slice(0, 8);
}

function AlphaScrollPane({
  items,
  paused,
}: {
  items: PredictionAlphaItem[];
  paused: boolean;
}) {
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    if (paused || items.length <= 1) return;
    const t = window.setInterval(() => {
      setIdx((i) => (i + 1) % items.length);
    }, 4200);
    return () => window.clearInterval(t);
  }, [paused, items.length]);

  const item = items[idx] ?? items[0];
  if (!item) return null;

  const isInternal = item.url.startsWith('/');

  return (
    <div className="relative mt-3 overflow-hidden rounded-md border border-border-subtle/50 bg-bg-base/60">
      <div className="flex items-center justify-between border-b border-border-subtle/40 px-2.5 py-1">
        <span className="text-[9px] font-semibold uppercase tracking-[0.1em] text-fg-muted">
          Alpha · Related
        </span>
        {paused ? (
          <span className="inline-flex items-center gap-1 text-[9px] font-medium text-accent-primary">
            <Pause className="h-3 w-3" /> Paused
          </span>
        ) : null}
      </div>
      <div className="pred-alpha-scroll px-2.5 py-2">
        {isInternal ? (
          <Link
            href={item.url}
            className="group/alpha block rounded-sm px-2 py-2 transition hover:bg-accent-primary/8"
          >
            <AlphaRow item={item} />
          </Link>
        ) : (
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="group/alpha block rounded-sm px-2 py-2 transition hover:bg-accent-primary/8"
          >
            <AlphaRow item={item} />
          </a>
        )}
      </div>
    </div>
  );
}

function AlphaRow({ item }: { item: PredictionAlphaItem }) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium text-fg-muted">{item.source}</span>
        <span className="text-[10px] tabular-nums text-fg-muted/70">{item.ago}</span>
      </div>
      <p className="mt-1 line-clamp-2 text-[11px] font-medium leading-snug text-fg-primary group-hover/alpha:text-accent-primary">
        {item.title}
      </p>
      {!item.url.startsWith('/') ? (
        <ExternalLink className="absolute right-3 top-8 h-3 w-3 text-fg-muted/50 opacity-0 transition group-hover/alpha:opacity-100" />
      ) : null}
    </>
  );
}

function HeroFeaturedCard({
  market,
  allMarkets,
  onQuickTrade,
  active,
}: {
  market: PredictionMarket;
  allMarkets: PredictionMarket[];
  onQuickTrade: PredictionQuickTradeHandler;
  active: boolean;
}) {
  const [hovered, setHovered] = useState(false);
  const feed = useMemo(() => relatedFeedItems(market, allMarkets), [market, allMarkets]);

  return (
    <article
      className={cn(
        'pred-hero-card relative flex min-w-[min(100%,420px)] flex-1 flex-col rounded-lg border p-4 transition-all duration-300',
        active ? 'opacity-100' : 'pointer-events-none absolute inset-0 opacity-0',
        hovered
          ? 'pred-hero-card--hover border-accent-primary/45 bg-bg-hover/55 shadow-[0_0_0_1px_rgb(var(--accent-primary-rgb)/0.25),0_0_28px_rgb(var(--accent-primary-rgb)/0.12)]'
          : 'border-border-subtle/60 bg-bg-hover/35',
      )}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <Link
        href={`/predictions/${market.id}`}
        className="absolute inset-0 z-0 rounded-lg"
        aria-label={`Open ${market.title}`}
      />
      <div className="relative z-[1] pointer-events-none">
        <div className="flex items-start justify-between gap-2">
          <PredictionMarketIcon market={market} size="lg" />
          <KalshiWordmark className="h-4 opacity-80" />
        </div>
        <h3 className="mt-2 line-clamp-2 text-[13px] font-semibold leading-snug text-fg-primary">
          {market.title}
        </h3>
        <p className="mt-0.5 text-[11px] text-fg-muted">{market.outcomeLabel}</p>

        <div className="mt-3 flex items-end justify-between gap-3">
          <ChanceReadout market={market} />
          <PredictionSparkline values={market.spark} width={88} height={32} />
        </div>

        <div className="pointer-events-auto mt-3">
          <YesNoTradeButtons market={market} onQuickTrade={onQuickTrade} size="lg" />
        </div>

        <ActiveBuyStrip trades={market.recentTrades} className="mt-2.5" />

        <div className="pointer-events-auto">
          <AlphaScrollPane items={feed} paused={hovered} />
        </div>

        <MarketStatsFooter
          volumeUsd={market.volumeUsd}
          liquidityUsd={market.liquidityUsd}
          endsIn={market.endsIn}
          closeTime={market.closeTime}
          className="mt-3"
        />
      </div>
    </article>
  );
}

export function PredictionsHeroCarousel({
  markets,
  allMarkets,
  onQuickTrade,
}: {
  markets: PredictionMarket[];
  allMarkets: PredictionMarket[];
  onQuickTrade: PredictionQuickTradeHandler;
}) {
  const featured = markets.filter((m) => m.featured).slice(0, 5);
  const slides = featured.length > 0 ? featured : markets.slice(0, 3);
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const advance = useCallback(() => {
    setIdx((i) => (i + 1) % slides.length);
  }, [slides.length]);

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    const t = window.setInterval(advance, 5500);
    return () => window.clearInterval(t);
  }, [paused, advance, slides.length]);

  if (slides.length === 0) return null;

  return (
    <div
      ref={wrapRef}
      className="shrink-0 border-b border-border-subtle/40 px-4 py-3"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      data-predictions-tour="hero"
    >
      <div className="relative min-h-[320px]">
        {slides.map((m, i) => (
          <HeroFeaturedCard
            key={m.id}
            market={m}
            allMarkets={allMarkets}
            onQuickTrade={onQuickTrade}
            active={i === idx}
          />
        ))}
      </div>
      {slides.length > 1 ? (
        <div className="mt-3 flex items-center justify-center gap-1.5">
          {slides.map((m, i) => (
            <button
              key={m.id}
              type="button"
              aria-label={`Show ${m.title}`}
              onClick={() => setIdx(i)}
              className={cn(
                'h-1.5 rounded-full transition-all',
                i === idx ? 'w-5 bg-accent-primary' : 'w-1.5 bg-fg-muted/35 hover:bg-fg-muted/55',
              )}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

// Re-export handler type for consumers
export type { PredictionQuickTradeHandler } from '@/components/predictions/YesNoTradeButtons';
