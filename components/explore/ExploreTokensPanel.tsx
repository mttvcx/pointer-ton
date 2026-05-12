'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Filter, Info, Layers, PauseCircle, PlayCircle, Search, Sparkles } from 'lucide-react';
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
    <div className="relative grid min-h-[480px] flex-1 animate-pulse place-items-center overflow-hidden rounded-2xl border border-white/[0.07] bg-[#070B12] lg:min-h-[calc(100vh-16rem)]">
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
  const { activePresetSlot, setActivePresetSlot } = useTradingStore();
  const uiDemoMode = useUiDemoMode();

  const exploreDemoForcedOff = searchParams.get('explore_demo') === '0';
  const exploreDemoForcedOn = searchParams.get('explore_demo') === '1';
  const exploreDemoEligible =
    !exploreDemoForcedOff &&
    (exploreDemoForcedOn || uiDemoMode || process.env.NODE_ENV === 'development');

  const [view, setView] = useState<ExploreViewMode>('bubbles');
  const [tw, setTw] = useState<ExploreTimeWindow>('1h');
  const [sortMode, setSortMode] = useState<ExploreSortMode>('mindshare');
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
    queryKey: ['explore', activeChain],
    queryFn: async (): Promise<{ items: PulseTokenBundle[] }> => {
      const res = await fetch(`/api/explore?chain=${encodeURIComponent(activeChain)}&limit=72`);
      if (!res.ok) throw new Error('explore_failed');
      return res.json() as Promise<{ items: PulseTokenBundle[] }>;
    },
    refetchInterval: paused ? false : 45_000,
    staleTime: 12_000,
  });

  const apiItems = exploreQ.data?.items;
  const apiLen = apiItems?.length ?? 0;

  const bundlesForExplore = useMemo(() => {
    if (apiLen > 0 && apiItems) return apiItems;
    if (!exploreDemoEligible) return [];
    return syntheticExploreDemoBundles(activeChain);
  }, [apiItems, apiLen, exploreDemoEligible, activeChain]);

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
    <div className="flex min-h-0 flex-1 flex-col gap-2.5">
      <div className="shrink-0">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <h1 className="text-[18px] font-semibold tracking-tight text-fg-primary">Explore</h1>
              <span className="rounded-full border border-white/[0.09] bg-white/[0.02] px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.12em] text-fg-muted">
                Beta
              </span>
              {showExploreDemoRibbon ? (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/[0.08] px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.12em] text-amber-200/90">
                  Demo data
                </span>
              ) : null}
            </div>
            <p className="mt-1 max-w-2xl text-[12.5px] leading-snug text-fg-secondary">
              What the market is paying attention to right now — mindshare across tokens, wallets, and social signals.
            </p>
            <p className="mt-1.5 text-[10px] text-fg-muted/90">
              <span className="font-semibold text-fg-secondary/95">{native}</span>
              {lastRefreshed ? (
                <>
                  {' '}
                  · last refreshed <span className="tabular-nums text-fg-muted">{lastRefreshed}</span>
                </>
              ) : null}
            </p>
          </div>
          <PresetSlotSwitcher activePresetSlot={activePresetSlot} onChange={setActivePresetSlot} />
        </div>

        <div className="mt-2.5 flex flex-col gap-2 rounded-2xl border border-white/[0.07] bg-[#0A1018]/55 p-2.5 backdrop-blur-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-lg border border-white/[0.08] bg-black/20 p-0.5">
                <button
                  type="button"
                  onClick={() => setView('bubbles')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                    view === 'bubbles'
                      ? 'bg-accent-primary text-fg-inverse shadow-[0_0_0_1px_rgba(56,189,248,0.25)]'
                      : 'text-fg-muted hover:bg-white/[0.04] hover:text-fg-secondary',
                  )}
                >
                  <Layers className="h-3.5 w-3.5" /> Bubbles
                </button>
                <button
                  type="button"
                  onClick={() => setView('table')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition',
                    view === 'table'
                      ? 'bg-accent-primary text-fg-inverse shadow-[0_0_0_1px_rgba(56,189,248,0.25)]'
                      : 'text-fg-muted hover:bg-white/[0.04] hover:text-fg-secondary',
                  )}
                >
                  Table
                </button>
              </div>
              <span className="hidden h-5 w-px bg-white/[0.08] lg:inline-block" aria-hidden />
              <div className="flex flex-wrap gap-1">
                {TIME_KEYS.map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => setTw(w)}
                    className={cn(
                      'rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition',
                      tw === w
                        ? 'bg-accent-primary/16 text-accent-primary ring-1 ring-accent-primary/40'
                        : 'text-fg-muted hover:bg-white/[0.04]',
                    )}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition',
                  paused
                    ? 'border-amber-400/35 bg-amber-500/12 text-amber-100'
                    : 'border-white/[0.08] bg-white/[0.02] text-fg-muted hover:border-emerald-400/35 hover:bg-emerald-500/12 hover:text-emerald-100',
                )}
              >
                {paused ? <PlayCircle className="h-3.5 w-3.5" /> : <PauseCircle className="h-3.5 w-3.5 text-emerald-300/95" />}
                {!paused ? <span className="ml-1 h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.65)]" /> : null}
                <span className="pl-0.5">{paused ? 'Paused' : 'Live'}</span>
              </button>
              {paused || reducedMotion ? (
                <span className="hidden text-[10px] text-fg-muted/90 md:inline">
                  {paused ? 'Field frozen for inspection' : 'Respecting reduced-motion — layout is static'}
                </span>
              ) : view === 'bubbles' ? (
                <span className="hidden text-[10px] text-fg-muted/80 xl:inline">Mindshare drift is subtle unless you pause.</span>
              ) : null}
            </div>
          </div>

          <div className="flex flex-col gap-2 border-t border-white/[0.05] pt-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-fg-muted/90">Signal</span>
              {SORT_MODES.map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setSortMode(m.id)}
                  className={cn(
                    'rounded-full px-2.5 py-0.5 text-[10px] font-semibold transition',
                    sortMode === m.id
                      ? 'bg-accent-primary/16 text-accent-primary ring-1 ring-accent-primary/40'
                      : 'text-fg-muted hover:bg-white/[0.04]',
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>

            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <div className="relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-[15px] w-[15px] -translate-y-1/2 text-fg-muted" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search token, ticker, or contract"
                  aria-label="Search tokens"
                  className="focus-ring h-10 w-full rounded-xl border border-white/[0.08] bg-[#070B12]/90 pl-8 pr-3 text-[12px] text-fg-primary placeholder:text-fg-muted/85"
                />
              </div>
              <button
                type="button"
                onClick={() => setFilterModal(true)}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-white/[0.1] bg-white/[0.03] px-3 text-[12px] font-semibold text-fg-secondary shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] backdrop-blur-sm hover:border-accent-primary/35 hover:bg-accent-primary/[0.08] hover:text-fg-primary"
              >
                <Filter className="h-4 w-4 opacity-85" /> Filters
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-1 border-t border-white/[0.04] pt-2">
            <span className="mr-1 self-center text-[9px] font-semibold uppercase tracking-[0.14em] text-fg-muted/90">
              Presets
            </span>
            {(
              [
                ['Top mindshare', 'topMind'] as const,
                ['High volume', 'highVol'] as const,
                ['Low risk', 'lowRisk'] as const,
                ['Under $50M', 'sub50'] as const,
                ['Under $5M', 'sub5'] as const,
                ['New pairs (<24h)', 'newPairs'] as const,
                ['Requires social cues', 'social'] as const,
              ] as const
            ).map(([lb, key]) => (
              <button
                key={key}
                type="button"
                onClick={() => applyExplorePreset(key)}
                className={cn(
                  'rounded-full border px-2 py-px text-[9.5px] font-semibold transition',
                  presetActive(key)
                    ? 'border-accent-primary/55 bg-accent-primary/14 text-accent-primary'
                    : 'border-white/[0.08] text-fg-muted hover:border-accent-primary/35 hover:text-fg-secondary',
                )}
              >
                {lb}
              </button>
            ))}
          </div>

          {filterChips.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {filterChips.map((c) => (
                <span
                  key={c}
                  className="rounded-full bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-fg-secondary ring-1 ring-white/10"
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
          className="flex shrink-0 items-start gap-2.5 rounded-xl border border-amber-500/[0.18] bg-amber-500/[0.045] px-3 py-2 text-amber-100/92 backdrop-blur-md"
        >
          <Info className="mt-0.5 h-[14px] w-[14px] shrink-0 text-amber-200/85" aria-hidden />
          <div className="min-w-0 leading-snug">
            <p className="text-[11px]">
              <span className="font-semibold tracking-tight text-amber-50/95">Demo dataset</span>
              {' — '}
              live indexer returned no rows for{' '}
              <span className="font-semibold text-amber-50/95">{native}</span>, so synthetic mindshare bubbles are shown.
            </p>
            <p className="mt-0.5 text-[10px] text-amber-200/55">
              Live rows replace this automatically when the feed is populated.
            </p>
          </div>
        </div>
      ) : null}

      {exploreQ.isLoading ? (
        <SkeletonBubbles />
      ) : exploreQ.isError ? (
        <div className="rounded-xl border border-white/12 bg-black/35 p-6 text-[13px] text-signal-bear">
          Could not reach Explore indexer. Retry using Pulse or swap chains once feeds warm.
        </div>
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

      <ExploreTokenDrawer item={selected} open={Boolean(selected)} onClose={() => setSelected(null)} />

      <ExploreFiltersModal open={filterModal} onClose={() => setFilterModal(false)} value={filters} onApply={setFilters} />

      <div className="flex flex-wrap items-start gap-x-3 gap-y-1 text-[10px] leading-relaxed text-fg-muted/88">
        <span className="inline-flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 shrink-0 text-accent-primary/72" aria-hidden />
          Mindshare blends market, wallet, and social signals as data becomes available.
        </span>
        {showExploreDemoRibbon ? (
          <span className="text-[9.5px] text-amber-200/52">
            Demo mode active · synthetic signals stand in until indexer rows exist.
          </span>
        ) : null}
      </div>
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
    <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.02] px-2 py-1.5 backdrop-blur-sm">
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">Trading</span>
      {([1, 2, 3] as const).map((slot) => (
        <button
          key={slot}
          type="button"
          title={`Trading preset slot ${slot}`}
          onClick={() => onChange(slot)}
          className={cn(
            'h-9 min-w-[40px] rounded-lg px-2 text-[11px] font-semibold transition',
            activePresetSlot === slot
              ? 'bg-accent-primary/18 text-accent-primary ring-1 ring-accent-primary/40'
              : 'text-fg-secondary hover:bg-bg-hover',
          )}
        >
          P{slot}
        </button>
      ))}
      <Link href="/pulse" className="text-[11px] font-semibold text-accent-primary hover:underline">
        Pulse quick-buy
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
        'relative flex flex-col items-center justify-center gap-6 overflow-hidden text-center',
        inCanvas
          ? 'min-h-[480px] lg:min-h-[calc(100vh-16rem)] rounded-2xl border border-white/[0.08] bg-[#070B12]'
          : 'min-h-[420px] lg:min-h-[calc(100vh-17rem)] rounded-2xl border border-dashed border-white/[0.1] bg-[#070B12]/90',
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
