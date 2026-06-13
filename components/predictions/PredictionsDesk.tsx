'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Clock,
  Droplets,
  LayoutGrid,
  List,
  Search,
} from 'lucide-react';
import {
  ALL_PREDICTION_TAGS,
  filterPredictionMarkets,
  KALSHI_PREDICTION_MARKETS,
  type PredictionDeskCategory,
  type PredictionSort,
  type PredictionView,
} from '@/lib/predictions/marketsDemo';
import {
  PredictionMarketCard,
  PredictionsFeaturedCard,
  PredictionsTableRow,
  type PredictionQuickTradeHandler,
} from '@/components/predictions/PredictionMarketCells';
import { PredictionQuickTradeModal } from '@/components/predictions/PredictionQuickTradeModal';
import { PredictionMarketIcon } from '@/components/predictions/PredictionMarketIcon';
import { PredictionTradePanel } from '@/components/predictions/PredictionTradePanel';
import { PredictionsHelpButton } from '@/components/predictions/PredictionsHelpButton';
import { usePredictionsTourOptional } from '@/components/predictions/PredictionsTourContext';
import { cn } from '@/lib/utils/cn';

const DESK_TABS: PredictionDeskCategory[] = [
  'Trending',
  'All',
  'Crypto',
  'Sports',
  'Politics',
  'Watchlist',
];

export function PredictionsDesk() {
  const [deskCategory, setDeskCategory] = useState<PredictionDeskCategory>('Trending');
  const [view, setView] = useState<PredictionView>(
    deskCategory === 'Trending' ? 'table' : 'cards',
  );
  const [sort, setSort] = useState<PredictionSort>('volume');
  const [tag, setTag] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [quickTrade, setQuickTrade] = useState<{
    market: (typeof KALSHI_PREDICTION_MARKETS)[number];
    outcome: 'yes' | 'no';
  } | null>(null);
  const tour = usePredictionsTourOptional();

  const openQuickTrade: PredictionQuickTradeHandler = (market, outcome) => {
    setQuickTrade({ market, outcome });
  };

  useEffect(() => {
    if (!tour) return;
    tour.registerDeskApi({ setDeskCategory, setView });
    return () => tour.registerDeskApi(null);
  }, [tour, setDeskCategory, setView]);

  const featured = useMemo(
    () => KALSHI_PREDICTION_MARKETS.filter((m) => m.featured).slice(0, 3),
    [],
  );

  const rows = useMemo(
    () =>
      filterPredictionMarkets({
        deskCategory,
        tag: deskCategory === 'All' ? tag : null,
        query,
        sort,
      }),
    [deskCategory, tag, query, sort],
  );

  const tableOnly = deskCategory === 'Trending';

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg-raised">
      <div className="shrink-0 border-b border-border-subtle/60 bg-bg-raised px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-4">
            <nav
              className="flex flex-wrap items-center gap-1"
              data-predictions-tour="categories"
            >
              {DESK_TABS.map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => {
                    setDeskCategory(tab);
                    if (tab === 'Trending') setView('table');
                  }}
                  className={cn(
                    'rounded-sm px-2.5 py-1 text-[13px] font-medium transition',
                    deskCategory === tab
                      ? 'bg-bg-hover text-fg-primary'
                      : 'text-fg-muted hover:text-fg-secondary',
                  )}
                >
                  {tab}
                </button>
              ))}
            </nav>
          </div>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2 max-w-md">
            <div
              className="relative min-w-[200px] flex-1"
              data-predictions-tour="search"
            >
              <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search prediction markets…"
                className="w-full rounded-md border border-border-subtle/60 bg-bg-hover/40 py-1.5 pl-8 pr-3 text-[12px] text-fg-primary outline-none placeholder:text-fg-muted/70 focus:border-accent-primary/35 focus:ring-1 focus:ring-accent-primary/20"
              />
            </div>
            <PredictionsHelpButton />
          </div>
        </div>
      </div>

      {deskCategory === 'Trending' && featured.length > 0 ? (
        <div className="shrink-0 border-b border-border-subtle/40 px-4 py-3">
          <div className="flex gap-3 overflow-x-auto pb-1">
            {featured.map((m) => (
              <PredictionsFeaturedCard key={m.id} market={m} onQuickTrade={openQuickTrade} />
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 overflow-hidden">
        <aside
          className="hidden w-[148px] shrink-0 flex-col gap-4 border-r border-border-subtle/40 bg-bg-raised p-3 lg:flex"
          data-predictions-tour="controls"
        >
          <div className="rounded-md border border-border-subtle/50 p-2">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">View</p>
            <div className="grid grid-cols-2 gap-1">
              <button
                type="button"
                disabled={tableOnly}
                title={tableOnly ? 'Trending is only available as a table' : undefined}
                onClick={() => setView('cards')}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-sm py-2 text-[10px] font-medium transition',
                  view === 'cards' && !tableOnly
                    ? 'bg-accent-primary/10 text-accent-primary ring-1 ring-accent-primary/30'
                    : 'text-fg-muted hover:bg-bg-hover disabled:cursor-not-allowed disabled:opacity-40',
                )}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                Cards
              </button>
              <button
                type="button"
                onClick={() => setView('table')}
                className={cn(
                  'flex flex-col items-center gap-1 rounded-sm py-2 text-[10px] font-medium transition',
                  view === 'table' || tableOnly
                    ? 'bg-accent-primary/10 text-accent-primary ring-1 ring-accent-primary/30'
                    : 'text-fg-muted hover:bg-bg-hover',
                )}
              >
                <List className="h-3.5 w-3.5" />
                Table
              </button>
            </div>
          </div>

          <div className="rounded-md border border-border-subtle/50 p-2">
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Sort by</p>
            <div className="flex gap-1">
              {(
                [
                  { id: 'volume' as const, icon: BarChart3, label: 'Volume' },
                  { id: 'liquidity' as const, icon: Droplets, label: 'Liquidity' },
                  { id: 'newest' as const, icon: Clock, label: 'Newest' },
                ] as const
              ).map(({ id, icon: Icon, label }) => (
                <button
                  key={id}
                  type="button"
                  title={label}
                  onClick={() => setSort(id)}
                  className={cn(
                    'flex flex-1 items-center justify-center rounded-sm py-2 transition',
                    sort === id
                      ? 'bg-accent-primary/10 text-accent-primary ring-1 ring-accent-primary/30'
                      : 'text-fg-muted hover:bg-bg-hover',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              ))}
            </div>
          </div>

          {deskCategory === 'All' ? (
            <div className="space-y-0.5 overflow-y-auto">
              {ALL_PREDICTION_TAGS.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTag(t === 'All' ? null : t)}
                  className={cn(
                    'block w-full rounded-sm px-2 py-1 text-left text-[11px] transition',
                    (t === 'All' && !tag) || tag === t
                      ? 'bg-bg-hover font-medium text-fg-primary'
                      : 'text-fg-muted hover:bg-bg-hover/60 hover:text-fg-secondary',
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          ) : null}
        </aside>

        <div className="min-h-0 flex-1 overflow-y-auto bg-bg-raised p-4" data-predictions-tour="markets">
          {view === 'table' || tableOnly ? (
            <div className="overflow-x-auto rounded-lg border border-border-subtle/60 bg-bg-hover/25">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-border-subtle/50 bg-bg-hover/40 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                    <th className="px-3 py-2">Market</th>
                    <th className="px-2 py-2">Chance</th>
                    <th className="hidden px-2 py-2 text-right lg:table-cell">Volume</th>
                    <th className="hidden px-2 py-2 text-right md:table-cell">Liquidity</th>
                    <th className="hidden px-2 py-2 text-right xl:table-cell">Txns</th>
                    <th className="hidden px-2 py-2 text-right lg:table-cell">Traders</th>
                    <th className="px-2 py-2 text-right">Ends</th>
                    <th className="px-3 py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m) => (
                    <PredictionsTableRow key={m.id} market={m} onQuickTrade={openQuickTrade} />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
              {rows.map((m) => (
                <PredictionMarketCard key={m.id} market={m} onQuickTrade={openQuickTrade} />
              ))}
            </div>
          )}

          {rows.length === 0 ? (
            <p className="py-12 text-center text-sm text-fg-muted">No markets match your filters.</p>
          ) : null}
        </div>
      </div>

      {quickTrade ? (
        <PredictionQuickTradeModal
          market={quickTrade.market}
          initialOutcome={quickTrade.outcome}
          onClose={() => setQuickTrade(null)}
        />
      ) : null}
    </div>
  );
}

export function PredictionsDetailDesk({ marketId }: { marketId: string }) {
  const market = KALSHI_PREDICTION_MARKETS.find((m) => m.id === marketId);
  const [tradeOutcome, setTradeOutcome] = useState<'yes' | 'no'>('yes');
  if (!market) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm font-semibold text-fg-primary">Market not found</p>
        <Link href="/predictions" className="text-[12px] text-accent-primary hover:underline">
          Back to Kalshi predictions
        </Link>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-bg-raised">
      <div className="flex shrink-0 items-center gap-3 border-b border-border-subtle/60 bg-bg-raised px-4 py-2">
        <Link href="/predictions" className="text-[11px] text-fg-muted hover:text-fg-primary">
          ← Predictions
        </Link>
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium text-fg-primary">
          {market.title}
        </span>
        <PredictionsHelpButton />
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 xl:grid-cols-[minmax(0,1fr)_18rem]">
        <div className="flex min-h-0 flex-col overflow-y-auto border-r border-border-subtle/40 bg-bg-raised">
          <div className="border-b border-border-subtle/40 px-4 py-3">
            <div className="flex flex-wrap items-start gap-3">
              <PredictionMarketIcon market={market} size="lg" />
              <div className="min-w-0 flex-1">
                <h1 className="text-base font-semibold text-fg-primary">{market.title}</h1>
                <p className="mt-1 text-[12px] text-fg-muted">
                  Live · {market.endsIn} left · Vol {market.volumeUsd.toLocaleString()} · Liq{' '}
                  {market.liquidityUsd.toLocaleString()}
                </p>
              </div>
            </div>
            <div className="mt-3 flex gap-2 text-[11px]">
              {(['Overview', 'Compare', 'Market'] as const).map((t, i) => (
                <span
                  key={t}
                  className={cn(
                    'rounded-sm px-2.5 py-1 font-medium',
                    i === 0 ? 'bg-bg-hover text-fg-primary' : 'text-fg-muted',
                  )}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>

          <div className="border-b border-border-subtle/30 px-4 py-6" data-predictions-tour="chart">
            <div className="flex h-[220px] items-end justify-center rounded-lg border border-border-subtle/50 bg-bg-hover/30 p-4">
              <div className="w-full max-w-lg">
                <div className="mb-2 flex justify-between text-[10px] tabular-nums text-fg-muted">
                  <span>Yes {market.yesPriceCents}¢</span>
                  <span>No {market.noPriceCents}¢</span>
                </div>
                <div className="h-32 rounded-sm bg-gradient-to-t from-emerald-500/10 to-transparent ring-1 ring-border-subtle/30" />
              </div>
            </div>
          </div>

          <div className="px-4 py-3">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
              Outcomes
            </h2>
            <div className="space-y-2">
              {[market.outcomeLabel, 'Other'].map((label, i) => (
                <div
                  key={label}
                  className="flex flex-wrap items-center gap-3 rounded-lg border border-border-subtle/50 bg-bg-hover/30 px-3 py-2.5"
                >
                  {i === 0 ? (
                    <PredictionMarketIcon market={market} size="sm" />
                  ) : (
                    <span className="text-lg">—</span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-medium text-fg-primary">{label}</p>
                  </div>
                  <span className="font-mono text-lg font-semibold tabular-nums">
                    {i === 0 ? market.yesPct : 0}%
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTradeOutcome('yes')}
                      className="btn-press rounded-sm bg-signal-bull/12 px-2.5 py-1 text-[11px] font-semibold text-signal-bull ring-1 ring-signal-bull/25 hover:bg-signal-bull/20"
                    >
                      Yes {i === 0 ? market.yesPriceCents : 0}¢
                    </button>
                    <button
                      type="button"
                      onClick={() => setTradeOutcome('no')}
                      className="btn-press rounded-sm bg-signal-bear/10 px-2.5 py-1 text-[11px] font-semibold text-signal-bear ring-1 ring-signal-bear/20 hover:bg-signal-bear/16"
                    >
                      No {i === 0 ? market.noPriceCents : 100}¢
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <PredictionTradePanel market={market} initialOutcome={tradeOutcome} />
      </div>
    </div>
  );
}
