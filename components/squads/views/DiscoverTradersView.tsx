'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  ChevronDown,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import { ChainIcon } from '@/components/squads/ChainIcon';
import { SquadSortShell } from '@/components/squads/squadsPrimitives';
import { cn } from '@/lib/utils/cn';
import {
  SAMPLE_RIGHT_RAIL,
  SAMPLE_SQUADS,
  SAMPLE_TRADERS,
  type RailEntry,
} from '@/lib/squads/sampleData';
import {
  SquadsListToggle,
  type SquadsViewMode,
} from '@/components/squads/SquadsListToggle';
import { TraderHeroCard } from '@/components/squads/TraderHeroCard';
import { TraderCompactRow } from '@/components/squads/TraderCompactRow';
import { SquadHeroCard } from '@/components/squads/SquadHeroCard';
import { SquadCompactRow } from '@/components/squads/SquadCompactRow';
import { MiniLeaderboard } from '@/components/squads/MiniLeaderboard';

type FilterKey =
  | 'all'
  | 'ethos_verified'
  | 'high_signal'
  | 'sol'
  | 'ton'
  | 'base'
  | 'high_activity'
  | 'low_risk';

export function DiscoverTradersView() {
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set(['all']));
  const [sort, setSort] = useState('signal');
  const [mode, setMode] = useState<SquadsViewMode>('traders');

  const railRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => {
      const el = railRef.current;
      if (el) el.open = mq.matches;
    };
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  const toggleFilter = (k: FilterKey) => {
    setFilters((prev) => {
      const n = new Set(prev);
      if (k === 'all') return new Set<FilterKey>(['all']);
      n.delete('all');
      if (n.has(k)) n.delete(k);
      else n.add(k);
      if (n.size === 0) n.add('all');
      return n;
    });
  };

  const tradersFiltered = useMemo(() => {
    let rows = [...SAMPLE_TRADERS];
    if (!filters.has('all')) {
      rows = rows.filter((t) => {
        if (filters.has('ethos_verified') && !t.ethosVerified) return false;
        if (filters.has('high_signal') && t.trustScore < 80) return false;
        if (filters.has('sol') && !t.chains.includes('sol')) return false;
        if (filters.has('ton') && !t.chains.includes('ton')) return false;
        if (filters.has('base') && !t.chains.includes('base')) return false;
        if (filters.has('high_activity') && t.volume30d < 2_000_000) return false;
        if (filters.has('low_risk') && t.drawdown > 25) return false;
        return true;
      });
    }
    rows.sort((a, b) =>
      sort === 'volume' ? b.volume30d - a.volume30d : b.pnl30d - a.pnl30d,
    );
    return rows;
  }, [filters, sort]);

  const squadsFiltered = useMemo(() => {
    let rows = SAMPLE_SQUADS.filter((s) => !s.isPrivate);
    if (!filters.has('all')) {
      rows = rows.filter((s) => {
        if (filters.has('ethos_verified') && !s.ethosVerified) return false;
        if (filters.has('high_signal') && s.trustScore < 80) return false;
        if (filters.has('sol') && !s.chains.includes('sol')) return false;
        if (filters.has('ton') && !s.chains.includes('ton')) return false;
        if (filters.has('base') && !s.chains.includes('base')) return false;
        if (filters.has('high_activity') && s.volume30d < 5_000_000) return false;
        return true;
      });
    }
    rows.sort((a, b) =>
      sort === 'volume' ? b.volume30d - a.volume30d : b.pnl30d - a.pnl30d,
    );
    return rows;
  }, [filters, sort]);

  const railWidgets: { title: string; entries: RailEntry[]; hint?: string }[] =
    mode === 'traders'
      ? [
          { title: 'Top PnL 7d', entries: SAMPLE_RIGHT_RAIL.topPnl7d, hint: '7d' },
          { title: 'Top Win Rate', entries: SAMPLE_RIGHT_RAIL.topWinRate, hint: '90d' },
          { title: 'Rising This Week', entries: SAMPLE_RIGHT_RAIL.risingThisWeek, hint: '7d' },
          { title: 'Most Followed', entries: SAMPLE_RIGHT_RAIL.mostFollowed },
        ]
      : [
          { title: 'Top Squads PnL 7d', entries: SAMPLE_RIGHT_RAIL.topSquadsPnl7d, hint: '7d' },
          { title: 'Top Squads Win Rate', entries: SAMPLE_RIGHT_RAIL.topSquadsWinRate, hint: '90d' },
          { title: 'Rising Squads', entries: SAMPLE_RIGHT_RAIL.risingSquadsThisWeek, hint: '7d' },
          { title: 'Most Followed Squads', entries: SAMPLE_RIGHT_RAIL.mostFollowedSquads },
        ];

  const activeFilterLabel =
    filters.has('all') || filters.size === 0 ? 'All' : `${filters.size} on`;

  function FilterChip({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick?: () => void;
    children: React.ReactNode;
  }) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
          active
            ? 'bg-accent-ethos/10 text-accent-ethos ring-1 ring-inset ring-accent-ethos/20'
            : 'bg-bg-sunken text-fg-secondary hover:bg-bg-hover hover:text-fg-primary',
        )}
      >
        {children}
      </button>
    );
  }

  return (
    <div className="grid min-h-0 gap-4 lg:grid-cols-[1fr_minmax(0,280px)] lg:gap-5">
      <div className="min-w-0 space-y-3">
        <details className="group/filters rounded-lg border border-border-subtle bg-bg-raised [&_summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-[11px] font-semibold text-fg-muted hover:bg-bg-hover/60">
            <span className="inline-flex items-center gap-2 text-fg-secondary">
              <SlidersHorizontal className="h-3.5 w-3.5 opacity-70" strokeWidth={2} />
              Filters & sort · {sort === 'volume' ? '30d volume' : 'Highest PnL'} ·{' '}
              <span className="text-fg-muted">{activeFilterLabel}</span>
            </span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-fg-muted transition-transform group-open/filters:rotate-180"
              strokeWidth={2}
              aria-hidden
            />
          </summary>
          <div className="border-t border-border-subtle px-3 pb-3 pt-3">
            <div className="flex flex-wrap items-center gap-2">
              <FilterChip
                active={filters.has('all')}
                onClick={() => setFilters(new Set<FilterKey>(['all']))}
              >
                All filters
              </FilterChip>
              <FilterChip
                active={filters.has('ethos_verified')}
                onClick={() => toggleFilter('ethos_verified')}
              >
                <ShieldCheck className="h-3 w-3 shrink-0 text-accent-ethos" strokeWidth={2.2} />
                Ethos verified
              </FilterChip>
              <FilterChip active={filters.has('high_signal')} onClick={() => toggleFilter('high_signal')}>
                <Zap className="h-3 w-3 shrink-0 text-signal-bull" strokeWidth={2.2} />
                High signal
              </FilterChip>
              <FilterChip active={filters.has('sol')} onClick={() => toggleFilter('sol')}>
                <ChainIcon chain="sol" size={12} />
                Solana
              </FilterChip>
              <FilterChip active={filters.has('ton')} onClick={() => toggleFilter('ton')}>
                <ChainIcon chain="ton" size={12} />
                TON
              </FilterChip>
              <FilterChip active={filters.has('base')} onClick={() => toggleFilter('base')}>
                <ChainIcon chain="base" size={12} />
                Base
              </FilterChip>
              <FilterChip active={filters.has('high_activity')} onClick={() => toggleFilter('high_activity')}>
                <Activity className="h-3 w-3 shrink-0 opacity-90" strokeWidth={2.2} />
                High activity
              </FilterChip>
              <FilterChip active={filters.has('low_risk')} onClick={() => toggleFilter('low_risk')}>
                <ShieldOff className="h-3 w-3 shrink-0 opacity-90" strokeWidth={2.2} />
                Low risk
              </FilterChip>
              <div className="ml-auto">
                <SquadSortShell
                  value={sort}
                  onChange={setSort}
                  options={[
                    { value: 'signal', label: 'Highest PnL' },
                    { value: 'volume', label: '30d volume' },
                  ]}
                />
              </div>
            </div>
          </div>
        </details>

        <div className="px-0.5">
          <SquadsListToggle mode={mode} onChange={setMode} />
        </div>

        {mode === 'traders' ? (
          <div className="flex flex-col gap-2.5">
            {tradersFiltered.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {tradersFiltered.slice(0, 3).map((t, i) => (
                  <TraderHeroCard key={t.id} trader={t} rank={i + 1} />
                ))}
                {tradersFiltered.slice(3).map((t, i) => (
                  <TraderCompactRow key={t.id} trader={t} rank={i + 4} />
                ))}
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {squadsFiltered.length === 0 ? (
              <EmptyState />
            ) : (
              <>
                {squadsFiltered.slice(0, 3).map((s, i) => (
                  <SquadHeroCard key={s.id} squad={s} rank={i + 1} />
                ))}
                {squadsFiltered.slice(3).map((s, i) => (
                  <SquadCompactRow key={s.id} squad={s} rank={i + 4} />
                ))}
              </>
            )}
          </div>
        )}
      </div>

      <aside className="min-w-0 w-full shrink-0 lg:sticky lg:top-[calc(var(--app-header-offset,0px)+8px)] lg:w-[280px] lg:self-start">
        <details
          ref={railRef}
          className="group/rail rounded-lg border border-border-subtle bg-bg-raised [&_summary::-webkit-details-marker]:hidden"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2.5 text-[11px] font-semibold text-fg-muted hover:bg-bg-hover/60">
            <span className="text-fg-secondary">Snapshot rankings · {railWidgets.length} lists</span>
            <ChevronDown
              className="h-4 w-4 shrink-0 text-fg-muted transition-transform group-open/rail:rotate-180"
              strokeWidth={2}
              aria-hidden
            />
          </summary>
          <div className="space-y-2 border-t border-border-subtle p-2 pt-2">
            {railWidgets.map((w) => (
              <MiniLeaderboard key={w.title} title={w.title} entries={w.entries} hint={w.hint} />
            ))}
          </div>
        </details>
      </aside>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-raised px-4 py-5 text-center">
      <p className="text-xs text-fg-muted">No rows match filters. Open Filters & adjust chips.</p>
    </div>
  );
}
