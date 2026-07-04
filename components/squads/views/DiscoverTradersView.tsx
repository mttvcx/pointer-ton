'use client';

import { useMemo, useState } from 'react';
import { Activity, ShieldCheck, ShieldOff, Zap } from 'lucide-react';
import { ChainIcon } from '@/components/squads/ChainIcon';
import { SquadSortShell } from '@/components/squads/squadsPrimitives';
import { cn } from '@/lib/utils/cn';
import { useDiscoverSquads } from '@/lib/hooks/useDiscoverSquads';
import {
  SAMPLE_RIGHT_RAIL,
  SAMPLE_TRADERS,
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
  const [railIdx, setRailIdx] = useState(0);
  const discoverSquads = useDiscoverSquads();

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
    let rows = (discoverSquads.data ?? []).filter((s) => !s.isPrivate);
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
  }, [filters, sort, discoverSquads.data]);

  const railWidgets =
    mode === 'traders'
      ? [
          { title: 'Top PnL 7d', entries: SAMPLE_RIGHT_RAIL.topPnl7d, hint: '7d' },
          { title: 'Top Win Rate', entries: SAMPLE_RIGHT_RAIL.topWinRate, hint: '90d' },
          { title: 'Rising', entries: SAMPLE_RIGHT_RAIL.risingThisWeek, hint: '7d' },
          { title: 'Most Followed', entries: SAMPLE_RIGHT_RAIL.mostFollowed },
        ]
      : [
          { title: 'Top PnL 7d', entries: SAMPLE_RIGHT_RAIL.topSquadsPnl7d, hint: '7d' },
          { title: 'Top Win Rate', entries: SAMPLE_RIGHT_RAIL.topSquadsWinRate, hint: '90d' },
          { title: 'Rising', entries: SAMPLE_RIGHT_RAIL.risingSquadsThisWeek, hint: '7d' },
          { title: 'Most Followed', entries: SAMPLE_RIGHT_RAIL.mostFollowedSquads },
        ];

  const activeRail = railWidgets[railIdx] ?? railWidgets[0]!;

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
          'flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium transition-colors',
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
    <div className="grid min-h-0 gap-4 lg:grid-cols-[1fr_240px] lg:gap-5">
      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-1 flex-wrap items-center gap-1.5 overflow-x-auto">
            <FilterChip active={filters.has('all')} onClick={() => setFilters(new Set<FilterKey>(['all']))}>
              All
            </FilterChip>
            <FilterChip active={filters.has('ethos_verified')} onClick={() => toggleFilter('ethos_verified')}>
              <ShieldCheck className="h-3 w-3 shrink-0 text-accent-ethos" strokeWidth={2.2} />
              Ethos
            </FilterChip>
            <FilterChip active={filters.has('high_signal')} onClick={() => toggleFilter('high_signal')}>
              <Zap className="h-3 w-3 shrink-0 text-signal-bull" strokeWidth={2.2} />
              Signal
            </FilterChip>
            <FilterChip active={filters.has('sol')} onClick={() => toggleFilter('sol')}>
              <ChainIcon chain="sol" size={12} />
              SOL
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
              Active
            </FilterChip>
            <FilterChip active={filters.has('low_risk')} onClick={() => toggleFilter('low_risk')}>
              <ShieldOff className="h-3 w-3 shrink-0 opacity-90" strokeWidth={2.2} />
              Low risk
            </FilterChip>
          </div>
          <SquadSortShell
            value={sort}
            onChange={setSort}
            options={[
              { value: 'signal', label: 'PnL' },
              { value: 'volume', label: 'Volume' },
            ]}
          />
        </div>

        <SquadsListToggle mode={mode} onChange={(m) => { setMode(m); setRailIdx(0); }} />

        {mode === 'traders' ? (
          <div className="flex flex-col gap-2">
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
          <div className="flex flex-col gap-2">
            {discoverSquads.isLoading ? (
              <EmptyState text="Loading squads…" />
            ) : squadsFiltered.length === 0 ? (
              <EmptyState
                text={
                  (discoverSquads.data?.length ?? 0) === 0
                    ? 'No public squads yet. Create one to get started.'
                    : 'No squads match these filters.'
                }
              />
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

      <aside className="min-w-0 lg:sticky lg:top-2 lg:self-start">
        <div className="rounded-lg border border-border-subtle bg-bg-raised p-3">
          <p className="mb-2 text-[11px] font-semibold text-fg-secondary">Rankings</p>
          <div className="mb-3 flex flex-wrap gap-1">
            {railWidgets.map((w, i) => (
              <button
                key={w.title}
                type="button"
                onClick={() => setRailIdx(i)}
                className={cn(
                  'rounded-md px-2 py-1 text-[10px] font-medium transition-colors',
                  railIdx === i
                    ? 'bg-accent-ethos/10 text-accent-ethos'
                    : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
                )}
              >
                {w.title}
              </button>
            ))}
          </div>
          <MiniLeaderboard title={activeRail.title} entries={activeRail.entries} hint={activeRail.hint} />
        </div>
      </aside>
    </div>
  );
}

function EmptyState({ text = 'No matches.' }: { text?: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-bg-raised px-4 py-5 text-center">
      <p className="text-xs text-fg-muted">{text}</p>
    </div>
  );
}
