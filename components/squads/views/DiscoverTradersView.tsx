'use client';

import { useMemo, useState, type ReactNode } from 'react';
import {
  BadgeCheck,
  ChevronRight,
  Clock,
  Filter,
  Layers,
  Shield,
  SlidersHorizontal,
  Sparkles,
  Target,
  Users,
  Zap,
  Link2,
} from 'lucide-react';
import { DEMO_TRADERS } from '@/lib/squads/demo';
import type { DemoTrader } from '@/lib/squads/demo';
import { traderDirectoryMeta } from '@/lib/squads/traderCardMeta';
import { ethosLevelLabel } from '@/lib/ethos/score';
import { useSquadsUiStore } from '@/store/squadsUiStore';
import { cn } from '@/lib/utils/cn';
import {
  OperatorSignalTone,
  SquadChip,
  SquadMonogram,
  SquadPanel,
  SquadSortShell,
  squadCardHoverInteractiveClass,
} from '@/components/squads/squadsPrimitives';

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

  return (
    <div className="grid min-h-0 gap-5 lg:grid-cols-[1fr_minmax(0,292px)]">
      <div className="min-w-0 space-y-3">
        <SquadPanel padding="p-3" tone="premium">
          <div className="flex flex-wrap items-center gap-2">
            <SquadChip
              selected={filters.has('all')}
              onClick={() => setFilters(new Set(['all']))}
              icon={<SlidersHorizontal className="h-3 w-3 opacity-70" strokeWidth={2.2} />}
            >
              All filters
            </SquadChip>
            <SquadChip
              selected={filters.has('ethos_verified')}
              onClick={() => toggle('ethos_verified')}
              icon={<BadgeCheck className="h-3 w-3 text-[#6ee7b7]" strokeWidth={2.2} />}
            >
              Ethos verified
            </SquadChip>
            <SquadChip
              selected={filters.has('high_signal')}
              onClick={() => toggle('high_signal')}
              icon={<Zap className="h-3 w-3 text-[#6ee7b7]" strokeWidth={2.2} />}
            >
              High signal
            </SquadChip>
            <SquadChip selected={filters.has('sol')} onClick={() => toggle('sol')}>
              Solana
            </SquadChip>
            <SquadChip selected={filters.has('ton')} onClick={() => toggle('ton')}>
              TON
            </SquadChip>
            <SquadChip selected={filters.has('base')} onClick={() => toggle('base')}>
              Base
            </SquadChip>
            <SquadChip
              selected={filters.has('high_activity')}
              onClick={() => toggle('high_activity')}
              icon={<Sparkles className="h-3 w-3 opacity-70" strokeWidth={2.2} />}
            >
              High activity
            </SquadChip>
            <SquadChip
              selected={filters.has('low_risk')}
              onClick={() => toggle('low_risk')}
              icon={<Shield className="h-3 w-3 opacity-70" strokeWidth={2.2} />}
            >
              Low risk
            </SquadChip>
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

      <aside className="min-w-0 space-y-3 lg:sticky lg:top-[calc(var(--app-header-offset,0px)+12px)] lg:self-start">
        <SquadPanel
          tone="premium"
          className="relative overflow-hidden border-l-[3px] border-l-[#3b82a8]/75 pl-[calc(1rem-3px)]"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            aria-hidden
            style={{
              background:
                'radial-gradient(120% 80% at 100% 0%, rgba(70,140,210,0.5) 0%, transparent 55%)',
            }}
          />
          <div className="relative">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.14em] text-fg-secondary">
              Trust signals
            </h2>
            <p className="mt-2 text-[11.5px] leading-relaxed text-fg-muted">
              Every trader is ranked using source-attributed on-chain and social signals.
            </p>
            <ul className="mt-5 space-y-3.5 text-[11px]">
              <TrustRow
                icon={<Shield className="h-4 w-4 text-[#6ab9e8]" strokeWidth={2.2} />}
                title="Ethos verification"
                body="Verified identity and history through Ethos."
              />
              <TrustRow
                icon={<Zap className="h-4 w-4 text-[#6ee7b7]" strokeWidth={2.2} />}
                title="Performance"
                body="PnL, win rate, drawdown, and risk-aware execution metrics."
              />
              <TrustRow
                icon={<Link2 className="h-4 w-4 text-[#b4a7f5]" strokeWidth={2.2} />}
                title="On-chain activity"
                body="Wallet history, volume footprint, and smart-money alignment."
              />
              <TrustRow
                icon={<Users className="h-4 w-4 text-[#fcd34d]" strokeWidth={2.2} />}
                title="Community reputation"
                body="Referrals, reviews, and peer vouches when available."
              />
            </ul>
            <button
              type="button"
              className="relative mt-5 flex w-full items-center justify-center gap-2 rounded-md border border-[#324556] bg-[#0f1620]/90 py-2.5 text-[11px] font-semibold text-fg-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] transition hover:border-[#4a6984] hover:text-fg-primary"
            >
              <Filter className="h-3.5 w-3.5 opacity-90" strokeWidth={2.2} />
              Learn how discovery works
            </button>
          </div>
        </SquadPanel>
      </aside>
    </div>
  );
}

function TrustRow({
  icon,
  title,
  body,
}: {
  icon: ReactNode;
  title: string;
  body: string;
}) {
  return (
    <li className="flex gap-3 rounded-md border border-[#252f3e]/70 bg-black/15 px-2.5 py-2 backdrop-blur-[2px]">
      <span className="mt-0.5 shrink-0">{icon}</span>
      <div>
        <p className="font-semibold tracking-tight text-fg-primary">{title}</p>
        <p className="mt-0.5 text-[11px] leading-snug text-fg-muted">{body}</p>
      </div>
    </li>
  );
}

function OperatorRow({ trader: t, onOpen }: { trader: DemoTrader; onOpen: () => void }) {
  const m = traderDirectoryMeta(t);
  const sigLevel = t.operatorLevel === 'high' ? 'high' : t.operatorLevel === 'medium' ? 'medium' : 'low';

  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          'group flex w-full flex-col rounded-lg border border-[#273340] bg-gradient-to-b from-[#141b26]/95 to-[#0a0d12] p-px text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] outline-none ring-offset-2 ring-offset-[#05070a] transition focus-visible:ring-2 focus-visible:ring-[#3b82c4]/40',
          squadCardHoverInteractiveClass,
          'hover:from-[#182132]/98',
        )}
      >
        <div className="flex flex-col gap-3 rounded-[7px] bg-[#0b0f14]/40 p-3 sm:flex-row sm:items-start sm:gap-4">
          <SquadMonogram
            live={m.winRatePct > 62}
            className={cn('shadow-inner', t.avatarTint)}
            size="lg"
          >
            {t.monogram}
          </SquadMonogram>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="text-[14px] font-semibold tracking-tight text-fg-primary">
                {t.displayName}
              </span>
              <span className="text-[11px] font-medium text-[#7ebef2]/95">@{t.handle}</span>
              {t.ethosVerified ? (
                <BadgeCheck className="h-4 w-4 shrink-0 text-[#6ee7b7]" strokeWidth={2.2} aria-label="Verified" />
              ) : null}
              <EthosTape level={ethosLevelLabel(t.ethos.level)} score={t.ethos.score} />
            </div>

            <p className="mt-2 line-clamp-2 text-[11.5px] leading-snug text-fg-secondary">
              {t.shortBio}
            </p>

            <div className="mt-2.5 flex flex-wrap gap-1">
              <span className="inline-flex items-center gap-1 rounded border border-[#2f4ab0]/35 bg-[#1e3a70]/14 px-1.5 py-px text-[10px] font-semibold tabular-nums text-[#93c5fd]">
                <Layers className="h-3 w-3 opacity-85" strokeWidth={2} />
                30d&nbsp;
                {t.volume30dUsd >= 1e6
                  ? `$${(t.volume30dUsd / 1e6).toFixed(2)}M`
                  : `$${(t.volume30dUsd / 1e3).toFixed(0)}K`}
              </span>
              <OperatorSignalTone level={sigLevel} />
            </div>

            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {t.chainTags.map((tag) => (
                <TagPill key={tag} muted>
                  {tag}
                </TagPill>
              ))}
              {t.strategyTags.map((tag) => (
                <TagPill key={tag}>{tag}</TagPill>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] sm:grid-cols-4 md:grid-cols-5">
              <Metric icon={<Target className="h-3 w-3" />} label="Win rate" accent="positive">
                {m.winRatePct}%
              </Metric>
              <Metric icon={<Clock className="h-3 w-3" />} label="Active days">
                {m.activeDays.toLocaleString()}d
              </Metric>
              <Metric icon={<Users className="h-3 w-3" />} label="Squads">
                {m.squadsJoined}
              </Metric>
              <Metric icon={<Layers className="h-3 w-3" />} label="Watched venues">
                {m.watchedVenues}
              </Metric>
              <Metric icon={<Zap className="h-3 w-3" />} label="Last active" className="sm:col-span-2 md:col-span-1">
                {m.lastActive}
              </Metric>
            </div>
          </div>

          <div className="flex shrink-0 flex-row items-center gap-3 border-t border-white/[0.04] pt-2 sm:w-[120px] sm:flex-col sm:border-t-0 sm:border-l sm:border-white/[0.06] sm:pl-4 sm:pt-0">
            <div className="hidden flex-col items-end gap-0.5 sm:flex">
              <VolumeBlock t={t} />
            </div>
            <div className="ml-auto flex items-center gap-2 sm:ml-0 sm:flex-col sm:gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-[#72bfeb] opacity-70 transition group-hover:opacity-100">
                Profile
              </span>
              <ChevronRight className="h-5 w-5 text-[#72bfeb] opacity-50 transition group-hover:translate-x-0.5 group-hover:opacity-100" strokeWidth={2.2} />
            </div>
          </div>
        </div>
      </button>
    </li>
  );
}

function EthosTape({ level, score }: { level: string; score: number }) {
  return (
    <span className="rounded border border-[#3f4f64]/65 bg-black/35 px-1.5 py-px text-[9.5px] font-bold uppercase tracking-wide text-[#c7d8eb] backdrop-blur-sm">
      {level}{' '}
      <span className="tabular-nums font-semibold text-fg-secondary">{Math.round(score).toLocaleString()}</span>
    </span>
  );
}

function TagPill({
  children,
  muted,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        'rounded border px-1.5 py-px text-[10px] font-medium',
        muted
          ? 'border-[#2c3548] bg-[#0f141f] text-fg-muted'
          : 'border-[#363f52]/90 bg-[#141b28]/90 text-[#c5d8ec]/90',
      )}
    >
      {children}
    </span>
  );
}

function VolumeBlock({ t }: { t: DemoTrader }) {
  return (
    <div className="text-right">
      <p className="text-[9px] font-semibold uppercase tracking-wide text-fg-muted">Volume 30d</p>
      <p className="text-[13px] font-semibold tabular-nums text-fg-primary">
        ${t.volume30dUsd >= 1e6 ? `${(t.volume30dUsd / 1e6).toFixed(2)}M` : `${(t.volume30dUsd / 1e3).toFixed(0)}K`}
      </p>
    </div>
  );
}

function Metric({
  icon,
  label,
  children,
  accent,
  className,
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  accent?: 'positive';
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex items-start gap-1.5 rounded border border-[#252e3e]/85 bg-black/35 px-2 py-1.5',
        accent === 'positive' && 'border-emerald-950/55 bg-emerald-950/[0.07]',
        className,
      )}
    >
      <span className="mt-px text-fg-muted opacity-85">{icon}</span>
      <div>
        <p className="text-[9px] font-bold uppercase tracking-wide text-fg-muted">{label}</p>
        <p
          className={cn(
            'text-[11px] font-semibold tabular-nums tracking-tight',
            accent === 'positive' ? 'text-[#86efac]' : 'text-fg-primary',
          )}
        >
          {children}
        </p>
      </div>
    </div>
  );
}
