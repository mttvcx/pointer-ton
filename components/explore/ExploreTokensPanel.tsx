'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, Flame, Info, Layers, PauseCircle, PlayCircle, Rocket, Search, Sparkles } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { ExploreMindshareCanvas } from '@/components/explore/ExploreMindshareCanvas';
import { ExploreTokenDrawer } from '@/components/explore/ExploreTokenDrawer';
import { ExploreFiltersModal } from '@/components/explore/ExploreFiltersModal';
import { ExploreTableMode } from '@/components/explore/ExploreTableMode';
import type {
  ExploreFilterState,
  ExploreSortMode,
  ExploreTimeWindow,
  ExploreViewMode,
} from '@/types/explore';
import { EMPTY_EXPLORE_FILTERS } from '@/types/explore';
import type { PulseTokenBundle } from '@/types/tokens';
import {
  applyExploreFilters,
  buildExploreItems,
  sortExploreItems,
} from '@/lib/explore/exploreItemBuilder';
import { syntheticExploreDemoBundles } from '@/lib/dev/demoPulseBundles';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { useUIStore } from '@/store/ui';
import { useTradingStore } from '@/store/trading';
import type { PresetSlot } from '@/store/trading';
import { cn } from '@/lib/utils/cn';

const SORT_MODES: { id: ExploreSortMode; label: string }[] = [
  { id: 'mindshare', label: 'Mindshare' },
  { id: 'wallets', label: 'Wallets' },
  { id: 'volume', label: 'Volume' },
  { id: 'fresh_wallets', label: 'Fresh wallets' },
  { id: 'kols', label: 'KOLs' },
  { id: 'new_pairs', label: 'New pairs' },
];

const TIME_KEYS: ExploreTimeWindow[] = ['5m', '1h', '6h', '24h'];

function SkeletonBubbles() {
  return (
    <div className="relative flex min-h-0 flex-1 animate-pulse place-items-center overflow-hidden rounded-xl border border-border-subtle bg-bg-base">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 72% 56% at 50% 44%, rgba(0,149,237,0.1) 0%, transparent 62%)',
        }}
      />
      {Array.from({ length: 9 }).map((_, i) => {
        const jitter = (((i * 37) % 17) / 17) * 40;
        return (
          <div
            key={i}
            className="absolute rounded-full bg-gradient-to-br from-white/[0.07] via-white/[0.03] to-transparent opacity-65"
            style={{
              width: 96 + jitter,
              height: 96 + jitter,
              left: `${22 + (((i * 71) % 55) / 55) * 58}%`,
              top: `${10 + (((i * 103) % 70) / 70) * 68}%`,
            }}
          />
        );
      })}
    </div>
  );
}

export function ExploreTokensPanel() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeChain = useUIStore((s) => s.activeChain);
  const native = nativeTicker(activeChain);
  const activePresetSlot = useTradingStore((s) => s.activePresetSlot);
  const setActivePresetSlot = useTradingStore((s) => s.setActivePresetSlot);
  const uiDemoMode = useUiDemoMode();

  const exploreDemoForcedOff = searchParams.get('explore_demo') === '0';
  const exploreDemoForcedOn = searchParams.get('explore_demo') === '1';

  const [view, setView] = useState<ExploreViewMode>('bubbles');
  const [feedCohort, setFeedCohort] = useState<'new' | 'trending'>('new');
  const [tw, setTw] = useState<ExploreTimeWindow>('5m');
  const [sortMode, setSortMode] = useState<ExploreSortMode>('new_pairs');
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<ExploreFilterState>({ ...EMPTY_EXPLORE_FILTERS });
  const [filterModal, setFilterModal] = useState(false);
  const [selected, setSelected] = useState<import('@/types/explore').TokenExploreItem | null>(null);
  const [hovered, setHovered] = useState<string | null>(null);
  const [paused, setPaused] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    function read() {
      setReducedMotion(mq.matches);
    }
    read();
    mq.addEventListener('change', read);
    return () => mq.removeEventListener('change', read);
  }, []);

  const exploreQ = useQuery({
    queryKey: ['explore', activeChain, feedCohort],
    queryFn: async (): Promise<{ items: PulseTokenBundle[] }> => {
      const res = await fetch(
        `/api/explore?chain=${encodeURIComponent(activeChain)}&limit=72&cohort=${feedCohort}`,
      );
      if (!res.ok) throw new Error('explore_failed');
      return res.json() as Promise<{ items: PulseTokenBundle[] }>;
    },
    refetchInterval: paused ? false : 45_000,
    staleTime: 12_000,
  });

  const apiItems = exploreQ.data?.items;
  const apiLen = apiItems?.length ?? 0;

  /** Empty indexer → synthetic bubbles only when UI demo is explicitly enabled. */
  const exploreDemoEligible =
    !exploreDemoForcedOff && (exploreDemoForcedOn || uiDemoMode);

  const bundlesForExplore = useMemo(() => {
    if (exploreQ.isError) return [];
    if (apiLen > 0 && apiItems) return apiItems;
    if (!exploreDemoEligible) return [];
    return syntheticExploreDemoBundles(activeChain);
  }, [exploreQ.isError, apiItems, apiLen, exploreDemoEligible, activeChain]);

  const showExploreDemoRibbon =
    apiLen === 0 && exploreDemoEligible && bundlesForExplore.length > 0;

  const built = useMemo(() => {
    return buildExploreItems({
      bundles: bundlesForExplore,
      chainTicker: native,
      timeWindow: tw,
    });
  }, [bundlesForExplore, native, tw]);

  const searched = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return built;
    return built.filter(
      (it) =>
        it.ticker.toLowerCase().includes(q) ||
        it.name.toLowerCase().includes(q) ||
        it.tokenAddress.toLowerCase().includes(q),
    );
  }, [built, search]);

  const filtered = useMemo(() => applyExploreFilters(searched, filters), [searched, filters]);

  const visible = useMemo(() => sortExploreItems(filtered, sortMode), [filtered, sortMode]);

  const filterChips = useMemo(() => {
    const ch: string[] = [];
    if (filters.minMcapUsd != null) ch.push(`Mcap ≥ $${filters.minMcapUsd.toLocaleString()}`);
    if (filters.maxMcapUsd != null) ch.push(`Mcap ≤ $${filters.maxMcapUsd.toLocaleString()}`);
    if (filters.minLiquidityUsd != null) ch.push(`Liq ≥ $${filters.minLiquidityUsd.toLocaleString()}`);
    if (filters.minVolumeUsd != null) ch.push(`Vol ≥ $${filters.minVolumeUsd.toLocaleString()}`);
    if (filters.minMindshare != null) ch.push(`Mindshare ≥ ${filters.minMindshare}`);
    if (filters.excludeHighRisk) ch.push('Low risk preset');
    if (filters.onlySocialSignals) ch.push('Social-linked');
    if (filters.onlyNewPairsHours != null) ch.push(`≤ ${filters.onlyNewPairsHours}h`);
    return ch;
  }, [filters]);

  function switchFeedCohort(next: 'new' | 'trending') {
    setFeedCohort(next);
    if (next === 'new') {
      setSortMode('new_pairs');
      setTw('5m');
    } else {
      setSortMode('mindshare');
      setTw('5m');
    }
  }

  const onOpenFull = useCallback(
    (mint: string) => {
      router.push(`/token/${encodeURIComponent(mint)}`);
    },
    [router],
  );

  function applyExplorePreset(which: keyof typeof PRESETS) {
    setFilters(PRESETS[which]);
  }

  const lastRefreshed =
    exploreQ.dataUpdatedAt > 0
      ? new Date(exploreQ.dataUpdatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : null;

  function presetActive(key: keyof typeof PRESETS): boolean {
    const a = PRESETS[key];
    return (
      filters.minMcapUsd === a.minMcapUsd &&
      filters.maxMcapUsd === a.maxMcapUsd &&
      filters.minLiquidityUsd === a.minLiquidityUsd &&
      filters.minVolumeUsd === a.minVolumeUsd &&
      filters.minMindshare === a.minMindshare &&
      filters.minWalletSignal === a.minWalletSignal &&
      filters.maxRisk === a.maxRisk &&
      filters.excludeHighRisk === a.excludeHighRisk &&
      filters.onlyNewPairsHours === a.onlyNewPairsHours &&
      filters.onlySocialSignals === a.onlySocialSignals
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col gap-1 overflow-hidden">
      <div className="shrink-0 space-y-1">
        <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
          <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
            <div className="flex items-center gap-1">
              <h1 className="text-[15px] font-semibold tracking-tight text-fg-primary">Explore</h1>
              <span className="rounded border border-border-subtle bg-bg-sunken px-1 py-px text-[8px] font-semibold uppercase tracking-wider text-fg-muted">
                Beta
              </span>
              {showExploreDemoRibbon ? (
                <span className="rounded border border-amber-500/35 bg-amber-500/10 px-1 py-px text-[8px] font-semibold uppercase tracking-wider text-amber-200/90">
                  Demo
                </span>
              ) : null}
            </div>
            <p
              className="hidden max-w-xl truncate text-[10px] text-fg-muted md:block"
              title="New-launch bubbles · Hot = tape ranks · Axiom = dense desk"
            >
              <span className="tabular-nums">{native}</span>
              {lastRefreshed ? <> · refreshed {lastRefreshed}</> : null}
            </p>
          </div>
          <PresetSlotSwitcher activePresetSlot={activePresetSlot} onChange={setActivePresetSlot} />
        </div>

        <div className="rounded-lg border border-border-subtle bg-bg-raised/90 p-1">
          <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
            <span className="text-[8px] font-semibold uppercase tracking-wider text-fg-muted">Feed</span>
            <div className="inline-flex rounded-md border border-border-subtle bg-bg-sunken p-px">
              <button
                type="button"
                onClick={() => switchFeedCohort('new')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-[5px] px-2 py-0.5 text-[10px] font-semibold transition',
                  feedCohort === 'new'
                    ? 'bg-accent-primary text-fg-inverse'
                    : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
                )}
              >
                <Rocket className="h-3 w-3 shrink-0 opacity-90" aria-hidden /> New
              </button>
              <button
                type="button"
                onClick={() => switchFeedCohort('trending')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-[5px] px-2 py-0.5 text-[10px] font-semibold transition',
                  feedCohort === 'trending'
                    ? 'bg-accent-primary text-fg-inverse'
                    : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
                )}
              >
                <Flame className="h-3 w-3 shrink-0 opacity-90" aria-hidden /> Hot
              </button>
            </div>
            <span className="h-3 w-px bg-border-subtle/90" aria-hidden />
            <span className="text-[8px] font-semibold uppercase tracking-wider text-fg-muted">Layout</span>
            <div className="inline-flex rounded-md border border-border-subtle bg-bg-sunken p-px">
              <button
                type="button"
                onClick={() => setView('bubbles')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-[5px] px-2 py-0.5 text-[10px] font-semibold transition',
                  view === 'bubbles'
                    ? 'bg-accent-primary text-fg-inverse'
                    : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
                )}
              >
                <Layers className="h-3 w-3 opacity-90" /> Bubbles
              </button>
              <button
                type="button"
                onClick={() => setView('axiom')}
                className={cn(
                  'inline-flex items-center gap-1 rounded-[5px] px-2 py-0.5 text-[10px] font-semibold transition',
                  view === 'axiom'
                    ? 'bg-accent-primary text-fg-inverse'
                    : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
                )}
              >
                Axiom
              </button>
            </div>
            <span className="h-3 w-px bg-border-subtle/90" aria-hidden />
            <span className="text-[8px] font-semibold uppercase tracking-wider text-fg-muted">Window</span>
            <div className="flex flex-wrap items-center gap-px">
              {TIME_KEYS.map((w) => (
                <button
                  key={w}
                  type="button"
                  disabled={feedCohort !== 'trending'}
                  title={
                    feedCohort !== 'trending'
                      ? 'Switch to Hot for multi-window tape stats'
                      : `Window ${w}`
                  }
                  onClick={() => setTw(w)}
                  className={cn(
                    'rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition',
                    feedCohort !== 'trending' && 'cursor-not-allowed opacity-35',
                    tw === w && feedCohort === 'trending'
                      ? 'bg-accent-primary/16 text-accent-primary ring-1 ring-accent-primary/35'
                      : 'text-fg-muted hover:bg-bg-hover',
                  )}
                >
                  {w}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setPaused((p) => !p)}
              title={paused ? 'Resume live layout' : 'Pause bubble drift'}
              className={cn(
                'ml-auto inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide transition',
                paused
                  ? 'border-amber-400/35 bg-amber-500/12 text-amber-100'
                  : 'border-border-subtle bg-bg-sunken text-fg-muted hover:border-emerald-500/35 hover:bg-emerald-500/10 hover:text-emerald-200',
              )}
            >
              {paused ? <PlayCircle className="h-3 w-3" /> : <PauseCircle className="h-3 w-3 text-emerald-300/95" />}
              {!paused ? (
                <span className="ml-0.5 h-1 w-1 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]" />
              ) : null}
              <span className="pl-0.5">{paused ? 'Paused' : 'Live'}</span>
            </button>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 border-t border-border-subtle/70 pt-1">
            <span className="text-[8px] font-semibold uppercase tracking-wider text-fg-muted">Signal</span>
            <div className="flex flex-wrap gap-px">
              {SORT_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSortMode(m.id)}
                  className={cn(
                    'rounded-full px-2 py-px text-[9px] font-semibold transition',
                    sortMode === m.id
                      ? 'bg-accent-primary/16 text-accent-primary ring-1 ring-accent-primary/35'
                      : 'text-fg-muted hover:bg-bg-hover',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <div className="flex min-w-[min(100%,20rem)] flex-1 basis-[240px] items-center gap-1">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search ticker / CA…"
                  aria-label="Search tokens"
                  className="focus-ring h-8 w-full rounded-lg border border-border-subtle bg-bg-sunken py-1 pl-7 pr-2 text-[11px] text-fg-primary placeholder:text-fg-muted"
                />
              </div>
              <button
                type="button"
                onClick={() => setFilterModal(true)}
                className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-border-subtle bg-bg-sunken px-2 text-[11px] font-semibold text-fg-secondary hover:border-accent-primary/35 hover:bg-accent-primary/10 hover:text-fg-primary"
              >
                <Filter className="h-3.5 w-3.5 opacity-85" /> Filters
              </button>
            </div>
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-0.5 border-t border-border-subtle/70 pt-1">
            <span className="text-[8px] font-semibold uppercase tracking-wider text-fg-muted">Presets</span>
            {(
              [
                ['Top MS', 'topMind'] as const,
                ['Hi vol', 'highVol'] as const,
                ['Low risk', 'lowRisk'] as const,
                ['<$50M', 'sub50'] as const,
                ['<$5M', 'sub5'] as const,
                ['<24h', 'newPairs'] as const,
                ['Social', 'social'] as const,
              ] as const
            ).map(([lb, key]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyExplorePreset(key)}
                className={cn(
                  'rounded-full border px-1.5 py-px text-[8.5px] font-semibold transition',
                  presetActive(key)
                    ? 'border-accent-primary/55 bg-accent-primary/14 text-accent-primary'
                    : 'border-border-subtle text-fg-muted hover:border-accent-primary/35 hover:text-fg-secondary',
                )}
              >
                {lb}
              </button>
            ))}
          </div>

          {filterChips.length > 0 ? (
            <div className="mt-1 flex flex-wrap gap-1 border-t border-border-subtle/70 pt-1">
              {filterChips.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-bg-sunken px-1.5 py-px text-[9px] font-medium text-fg-secondary ring-1 ring-border-subtle"
                >
                  {c}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {showExploreDemoRibbon ? (
        <div
          role="status"
          className="flex shrink-0 items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/[0.04] px-2 py-1 text-[10px] text-amber-100/92"
        >
          <Info className="h-3 w-3 shrink-0 text-amber-200/85" aria-hidden />
          <span>
            <span className="font-semibold text-amber-50/95">Synthetic field</span>
            {' — '}no indexer rows for {native}; bubbles auto-fill until live data arrives.
          </span>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-hidden">
        {exploreQ.isError ? (
          <div className="rounded-xl border border-border-subtle bg-bg-sunken p-6 text-[13px] text-signal-bear">
            Could not reach Explore indexer. Retry using Pulse or swap chains once feeds warm.
          </div>
        ) : bundlesForExplore.length === 0 && exploreQ.isPending ? (
          <SkeletonBubbles />
        ) : visible.length === 0 ? (
          <EmptyExplore hasAny={built.length > 0} filtered={filtered.length !== built.length} inCanvas />
        ) : view === 'bubbles' ? (
          <ExploreMindshareCanvas
            items={visible.slice(0, 64)}
            searchQuery={search}
            reducedMotion={reducedMotion}
            layoutFrozen={paused || reducedMotion}
            selectedAddress={selected?.tokenAddress ?? null}
            hoveredAddress={hovered}
            onHover={setHovered}
            onSelect={(mint) => {
              const it = visible.find((v) => v.tokenAddress === mint) ?? null;
              setSelected(it);
            }}
            onOpenTokenPage={onOpenFull}
          />
        ) : (
          <ExploreTableMode
            items={visible}
            sortMode={sortMode}
            timeWindow={tw}
            onSortMode={setSortMode}
            onOpenRow={(item) => setSelected(item)}
          />
        )}
      </div>

      <ExploreTokenDrawer item={selected} open={Boolean(selected)} onClose={() => setSelected(null)} />

      <ExploreFiltersModal open={filterModal} onClose={() => setFilterModal(false)} value={filters} onApply={setFilters} />

      {!showExploreDemoRibbon ? (
        <div className="shrink-0 text-[9px] leading-snug text-fg-muted">
          <span className="inline-flex items-center gap-1">
            <Sparkles className="h-2.5 w-2.5 shrink-0 text-accent-primary/72" aria-hidden />
            Mindshare blends tape signals as ingestion expands.
          </span>
        </div>
      ) : null}
    </div>
  );
}

const PRESETS: Record<
  'topMind' | 'highVol' | 'lowRisk' | 'sub50' | 'sub5' | 'newPairs' | 'social',
  ExploreFilterState
> = {
  topMind: { ...EMPTY_EXPLORE_FILTERS, minMindshare: 62 },
  highVol: { ...EMPTY_EXPLORE_FILTERS, minVolumeUsd: 125_000 },
  lowRisk: { ...EMPTY_EXPLORE_FILTERS, excludeHighRisk: true, maxRisk: 55 },
  sub50: { ...EMPTY_EXPLORE_FILTERS, maxMcapUsd: 50_000_000 },
  sub5: { ...EMPTY_EXPLORE_FILTERS, maxMcapUsd: 5_000_000 },
  newPairs: { ...EMPTY_EXPLORE_FILTERS, onlyNewPairsHours: 24 },
  social: { ...EMPTY_EXPLORE_FILTERS, onlySocialSignals: true },
};

function PresetSlotSwitcher({
  activePresetSlot,
  onChange,
}: {
  activePresetSlot: PresetSlot;
  onChange: (s: PresetSlot) => void;
}) {
  return (
    <div className="flex shrink-0 flex-wrap items-center gap-1 rounded-lg border border-border-subtle bg-bg-sunken px-1.5 py-1">
      <span className="text-[8px] font-semibold uppercase tracking-wider text-fg-muted">Trade</span>
      {([1, 2, 3] as const).map((slot) => (
        <button
          key={slot}
          type="button"
          title={`Trading preset slot ${slot}`}
          onClick={() => onChange(slot)}
          className={cn(
            'h-7 min-w-[34px] rounded-md px-1.5 text-[10px] font-semibold transition',
            activePresetSlot === slot
              ? 'bg-accent-primary/18 text-accent-primary ring-1 ring-accent-primary/40'
              : 'text-fg-secondary hover:bg-bg-hover',
          )}
        >
          P{slot}
        </button>
      ))}
      <Link href="/pulse" className="text-[10px] font-semibold text-accent-primary hover:underline">
        Pulse
      </Link>
    </div>
  );
}

function EmptyExplore({
  hasAny,
  filtered,
  inCanvas,
}: {
  hasAny: boolean;
  filtered: boolean;
  inCanvas?: boolean;
}) {
  return (
    <div
      className={cn(
        'relative flex min-h-0 flex-1 flex-col items-center justify-center gap-6 overflow-hidden text-center',
        inCanvas
          ? 'min-h-[220px] rounded-xl border border-border-subtle bg-bg-base'
          : 'min-h-[220px] rounded-xl border border-dashed border-border-subtle bg-bg-base',
      )}
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_40%,rgba(0,149,237,0.08),transparent_60%)]" />
      <div className="pointer-events-none absolute inset-0 opacity-[0.14] bg-[radial-gradient(circle,#ffffff14_1px,transparent_1.2px)] [background-size:24px_24px]" />

      <div className="relative z-[1] px-8 py-14">
        <Sparkles className="mx-auto h-9 w-9 text-accent-primary/85" aria-hidden />
        <div className="mt-6">
          <h2 className="text-[18px] font-semibold tracking-tight text-fg-primary">
            {hasAny
              ? filtered
                ? 'Nothing on this lens'
                : 'Signal is diffuse'
              : 'Explore is waiting for signal'}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[13px] leading-relaxed text-fg-secondary">
            {hasAny
              ? 'Widen timeframe, clear filters, or relax presets — bubbles repack once a token qualifies.'
              : 'Tokens appear once Pointer detects market, wallet, or social activity on this chain — or enable UI demo locally when you are polishing UX.'}
          </p>
        </div>
        <div className="mx-auto mt-8 flex flex-wrap justify-center gap-2.5">
          <Link
            href="/pulse"
            className="rounded-xl bg-accent-primary px-4 py-2.5 text-[12px] font-semibold text-fg-inverse shadow-[0_0_0_1px_rgba(56,189,248,0.2)] hover:bg-accent-glow"
          >
            Go to Pulse
          </Link>
          <Link
            href="/trackers"
            className="rounded-xl border border-white/[0.1] bg-white/[0.03] px-4 py-2.5 text-[12px] font-semibold text-fg-primary backdrop-blur-sm hover:bg-white/[0.06]"
          >
            Add tracked wallets
          </Link>
          <span className="rounded-xl border border-dashed border-white/[0.1] px-4 py-2.5 text-[11px] text-fg-muted">
            Linked X surfaces roll out from token pages as ingestion expands.
          </span>
          <span className="basis-full pt-2 text-[10.5px] text-fg-muted/85">Switch cohort from the shell header anytime.</span>
        </div>
      </div>
    </div>
  );
}
