'use client';

import { useMemo, useState } from 'react';
import type { ChainFocus } from '@/lib/squads/types';
import {
  Activity,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Link2,
  Shield,
  ShieldCheck,
  ShieldOff,
  SlidersHorizontal,
  Users,
  Zap,
} from 'lucide-react';
import { DEMO_TRADERS } from '@/lib/squads/demo';
import type { DemoTrader } from '@/lib/squads/demo';
import type { EthosLevel } from '@/lib/ethos/types';
import { traderDirectoryMeta } from '@/lib/squads/traderCardMeta';
import { ethosLevelLabel } from '@/lib/ethos/score';
import { useSquadsUiStore } from '@/store/squadsUiStore';
import { cn } from '@/lib/utils/cn';
import { ChainIcon } from '@/components/squads/ChainIcon';
import { EthosGlyph } from '@/components/squads/EthosWordmark';
import { SquadPanel, SquadSortShell, squadCardHoverInteractiveClass } from '@/components/squads/squadsPrimitives';

type FilterKey =
  | 'all'
  | 'ethos_verified'
  | 'high_signal'
  | 'sol'
  | 'ton'
  | 'base'
  | 'high_activity'
  | 'low_risk';

function fmtVol30d(usd: number) {
  return usd >= 1e6 ? `$${(usd / 1e6).toFixed(2)}M` : `$${(usd / 1e3).toFixed(0)}K`;
}

function tierKey(level: EthosLevel): 'reputable' | 'exemplary' | 'neutral' {
  if (level === 'exemplary') return 'exemplary';
  if (level === 'reputable') return 'reputable';
  return 'neutral';
}

function chainLabel(c: ChainFocus): string {
  switch (c) {
    case 'sol':
      return 'Solana';
    case 'ton':
      return 'TON';
    case 'base':
      return 'Base';
    case 'bnb':
      return 'BNB';
    case 'hyperliquid':
      return 'Hyperliquid';
    case 'multi':
      return 'Multi';
    default:
      return c;
  }
}

export function DiscoverTradersView() {
  const openDemo = useSquadsUiStore((s) => s.openDemoTrader);
  const [filters, setFilters] = useState<Set<FilterKey>>(new Set(['all']));
  const [sort, setSort] = useState('signal');

  const toggle = (k: FilterKey) => {
    setFilters((prev) => {
      const n = new Set(prev);
      if (k === 'all') return new Set(['all']);
      n.delete('all');
      if (n.has(k)) n.delete(k);
      else n.add(k);
      if (n.size === 0) n.add('all');
      return n;
    });
  };

  const filtered = useMemo(() => {
    let rows = [...DEMO_TRADERS];
    if (!filters.has('all')) {
      rows = rows.filter((t) => {
        let ok = true;
        if (filters.has('ethos_verified') && !t.ethosVerified) ok = false;
        if (filters.has('high_signal') && t.operatorLevel !== 'high') ok = false;
        if (filters.has('sol') && !t.chains.includes('sol')) ok = false;
        if (filters.has('ton') && !t.chains.includes('ton')) ok = false;
        if (filters.has('base') && !t.chains.includes('base')) ok = false;
        if (filters.has('high_activity') && t.volume30dUsd < 2_000_000) ok = false;
        if (filters.has('low_risk') && t.riskFlags.length > 0) ok = false;
        return ok;
      });
    }
    rows.sort((a, b) => {
      if (sort === 'signal') {
        const o = { high: 0, medium: 1, low: 2, unknown: 3 };
        return o[a.operatorLevel] - o[b.operatorLevel];
      }
      return b.volume30dUsd - a.volume30dUsd;
    });
    return rows;
  }, [filters, sort]);

  const trustBlocks = [
    {
      Icon: ShieldCheck,
      label: 'Ethos verification',
      desc: 'Verified identity and history through Ethos.',
      accent: true as const,
    },
    {
      Icon: Zap,
      label: 'Performance',
      desc: 'PnL, win rate, drawdown, and risk-aware execution metrics.',
    },
    {
      Icon: Link2,
      label: 'On-chain activity',
      desc: 'Wallet history, volume footprint, and smart-money alignment.',
    },
    {
      Icon: Users,
      label: 'Community reputation',
      desc: 'Referrals, reviews, and peer vouches when available.',
    },
  ];

  type ChipProps = { active: boolean; onClick?: () => void; children: React.ReactNode };

  function FilterChip({ active, onClick, children }: ChipProps) {
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
    <div className="grid min-h-0 gap-5 lg:grid-cols-[1fr_minmax(0,280px)]">
      <div className="min-w-0 space-y-3">
        <SquadPanel padding="p-3" tone="premium">
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip active={filters.has('all')} onClick={() => setFilters(new Set(['all']))}>
              <SlidersHorizontal className="h-3 w-3 shrink-0 opacity-80" strokeWidth={2.2} />
              All filters
            </FilterChip>
            <FilterChip active={filters.has('ethos_verified')} onClick={() => toggle('ethos_verified')}>
              <ShieldCheck className="h-3 w-3 shrink-0 text-accent-ethos" strokeWidth={2.2} />
              Ethos verified
            </FilterChip>
            <FilterChip active={filters.has('high_signal')} onClick={() => toggle('high_signal')}>
              <Zap className="h-3 w-3 shrink-0 text-signal-bull" strokeWidth={2.2} />
              High signal
            </FilterChip>
            <FilterChip active={filters.has('sol')} onClick={() => toggle('sol')}>
              <ChainIcon chain="sol" size={12} />
              Solana
            </FilterChip>
            <FilterChip active={filters.has('ton')} onClick={() => toggle('ton')}>
              <ChainIcon chain="ton" size={12} />
              TON
            </FilterChip>
            <FilterChip active={filters.has('base')} onClick={() => toggle('base')}>
              <ChainIcon chain="base" size={12} />
              Base
            </FilterChip>
            <FilterChip active={filters.has('high_activity')} onClick={() => toggle('high_activity')}>
              <Activity className="h-3 w-3 shrink-0 opacity-90" strokeWidth={2.2} />
              High activity
            </FilterChip>
            <FilterChip active={filters.has('low_risk')} onClick={() => toggle('low_risk')}>
              <ShieldOff className="h-3 w-3 shrink-0 opacity-90" strokeWidth={2.2} />
              Low risk
            </FilterChip>
            <div className="ml-auto">
              <SquadSortShell
                value={sort}
                onChange={setSort}
                options={[
                  { value: 'signal', label: 'Highest signal' },
                  { value: 'volume', label: '30d volume' },
                ]}
              />
            </div>
          </div>
        </SquadPanel>

        <ul className="flex flex-col gap-2.5">
          {filtered.map((t) => (
            <OperatorRow key={t.id} trader={t} onOpen={() => openDemo(t)} />
          ))}
        </ul>
      </div>

      <aside className="min-w-0 w-full shrink-0 rounded-lg border border-border-subtle bg-bg-raised p-4 lg:sticky lg:top-[calc(var(--app-header-offset,0px)+12px)] lg:w-[280px] lg:self-start">
        <div className="mb-3 flex items-center gap-2">
          <Shield className="h-3.5 w-3.5 text-accent-ethos" strokeWidth={2.2} aria-hidden />
          <h3 className="text-xs font-semibold uppercase tracking-widest text-fg-primary">Trust Signals</h3>
        </div>
        <p className="mb-4 text-xs leading-relaxed text-fg-secondary">
          Every trader is ranked using source-attributed on-chain and social signals.
        </p>

        {trustBlocks.map((s) => (
          <div
            key={s.label}
            className="flex items-start gap-2.5 border-t border-border-subtle/50 py-2.5 first:border-t-0 first:pt-0"
          >
            <div
              className={cn(
                'flex h-7 w-7 shrink-0 items-center justify-center rounded',
                s.accent ? 'bg-accent-ethos/10 text-accent-ethos' : 'bg-bg-sunken text-fg-muted',
              )}
            >
              <s.Icon className="h-3.5 w-3.5" strokeWidth={2.2} />
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="text-xs font-semibold text-fg-primary">{s.label}</span>
              <span className="text-[11px] leading-relaxed text-fg-muted">{s.desc}</span>
            </div>
          </div>
        ))}

        <button
          type="button"
          className="mt-3 flex h-8 w-full items-center justify-center gap-1.5 rounded-md bg-bg-sunken text-xs font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary"
        >
          <BookOpen className="h-3 w-3" strokeWidth={2.2} /> Learn how discovery works
        </button>
      </aside>
    </div>
  );
}

function OperatorRow({ trader: t, onOpen }: { trader: DemoTrader; onOpen: () => void }) {
  const m = traderDirectoryMeta(t);
  const tier = tierKey(t.ethos.level);
  const tierScore = Math.round(t.ethos.score).toLocaleString();
  const sigLevel =
    t.operatorLevel === 'high' ? 'high' : t.operatorLevel === 'medium' ? 'medium' : ('low' as const);
  const signalShown = sigLevel === 'high' || sigLevel === 'medium';
  const vol = fmtVol30d(t.volume30dUsd);
  const winBull = parseFloat(`${m.winRatePct}`) >= 60;
  const winBear = parseFloat(`${m.winRatePct}`) < 45;

  const live = t.operatorLevel === 'high' || m.winRatePct > 62;

  const stats: {
    label: string;
    value: string;
    accent?: 'bull' | 'bear';
  }[] = [
    { label: 'Win rate', value: `${m.winRatePct}%`, accent: winBull ? 'bull' : winBear ? 'bear' : undefined },
    { label: 'Active days', value: `${m.activeDays.toLocaleString()}d` },
    { label: 'Squads', value: `${m.squadsJoined}` },
    { label: 'Watched venues', value: `${m.watchedVenues}` },
  ];

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'group w-full rounded-lg border border-border-subtle bg-bg-raised p-4 text-left transition-colors hover:border-border',
          squadCardHoverInteractiveClass,
        )}
      >
        <article>
          <div className="flex items-start gap-3">
            <div className="relative shrink-0">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-bg-sunken text-sm font-bold text-fg-secondary">
                {t.monogram}
              </div>
              {live ? (
                <span className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-signal-bull ring-2 ring-bg-raised" />
              ) : null}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-base font-bold tracking-tight text-fg-primary">{t.displayName}</span>
                <span className="text-xs text-fg-muted transition-colors group-hover:text-accent-ethos">
                  @{t.handle}
                </span>
                {t.ethosVerified ? (
                  <CheckCircle2
                    className="h-3.5 w-3.5 shrink-0 text-accent-ethos"
                    strokeWidth={2.2}
                    aria-label="Verified"
                  />
                ) : null}
              </div>
              <p className="mt-0.5 line-clamp-2 text-xs leading-snug text-fg-secondary">{t.shortBio}</p>
            </div>

            <div className="flex shrink-0 flex-col items-end text-right">
              <span className="text-[10px] uppercase tracking-[0.16em] text-fg-muted">Volume 30d</span>
              <span className="text-lg font-bold tabular-nums leading-tight tracking-tight text-fg-primary">
                {vol}
              </span>
              <span className="mt-0.5 flex items-center gap-0.5 text-[11px] font-medium text-accent-ethos transition-colors group-hover:text-accent-glow">
                Profile <ArrowRight className="h-3 w-3 shrink-0" strokeWidth={2.2} />
              </span>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span
              className={cn(
                'flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-bold uppercase tracking-wide',
                tier === 'reputable' && 'bg-accent-ethos/15 text-accent-ethos',
                tier === 'exemplary' && 'bg-signal-bull/15 text-signal-bull',
                tier === 'neutral' && 'bg-fg-muted/15 text-fg-secondary',
              )}
            >
              <EthosGlyph className="h-2.5 w-2.5" /> {ethosLevelLabel(t.ethos.level)} {tierScore}
            </span>
            <span className="flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-medium tabular-nums bg-bg-sunken text-fg-secondary">
              30d {vol}
            </span>
            {signalShown ? (
              <span
                className={cn(
                  'flex h-5 items-center gap-1 rounded px-1.5 text-[10px] font-medium',
                  sigLevel === 'high' && 'bg-signal-bull/15 text-signal-bull',
                  sigLevel === 'medium' && 'bg-signal-warn/15 text-signal-warn',
                )}
              >
                <Zap className="h-2.5 w-2.5 shrink-0" strokeWidth={2.4} /> {sigLevel} signal
              </span>
            ) : null}

            {t.chains.map((c) =>
              c === 'multi' ? null : (
                <span
                  key={c}
                  className="flex h-5 w-5 items-center justify-center rounded bg-bg-sunken"
                  title={chainLabel(c)}
                >
                  <ChainIcon chain={c} size={11} />
                </span>
              ),
            )}
            {t.strategyTags.map((tag) => (
              <span key={tag} className="flex h-5 items-center rounded bg-bg-sunken px-1.5 text-[10px] font-medium text-fg-muted">
                {tag}
              </span>
            ))}
          </div>

          <div className="mt-3 grid grid-cols-4 divide-x divide-border-subtle overflow-hidden rounded border border-border-subtle">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col bg-bg-raised px-3 py-2 first:border-l-0">
                <span className="text-[10px] uppercase tracking-[0.14em] text-fg-muted">{s.label}</span>
                <span
                  className={cn(
                    'mt-0.5 text-sm font-semibold tabular-nums tracking-tight',
                    s.accent === 'bull' && 'text-signal-bull',
                    s.accent === 'bear' && 'text-signal-bear',
                    !s.accent && 'text-fg-primary',
                  )}
                >
                  {s.value}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-border-subtle/50 pt-2">
            <span className="text-[10px] uppercase tracking-[0.14em] text-fg-muted">Last active</span>
            <span className="text-xs tabular-nums text-fg-secondary">{m.lastActive ?? '—'}</span>
          </div>
        </article>
      </button>
    </li>
  );
}
