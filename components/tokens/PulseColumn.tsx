'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  PanelsLeftRight,
  SlidersHorizontal,
  Zap,
} from 'lucide-react';
import { toast } from 'sonner';
import { ColumnFilterModal, type ColumnPresetRowDto } from '@/components/tokens/ColumnFilterModal';
import { EmptyState } from '@/components/shared/EmptyState';
import { PulseColumnSkeleton } from '@/components/tokens/PulseColumnSkeleton';
import { QuoteTokenIcon } from '@/components/tokens/ProtocolBrandIcon';
import { TokenRow } from '@/components/tokens/TokenRow';
import { createClient } from '@/lib/supabase/client';
import {
  mergeSnapshotIntoPulseCache,
  mergeTokenIntoPulseCache,
} from '@/lib/pulse/realtimeCache';
import {
  DEFAULT_COLUMN_DISPLAY_OPTIONS,
  type ColumnDisplayOptions,
  type ColumnPresetSharePayload,
  type ColumnSortKey,
  COLUMN_SORT_KEYS,
  normalizeColumnDisplayOptions,
  defaultColumnFiltersForChain,
  normalizeColumnFilters,
  pulseBundleMatchesFilters,
  sortPulseBundles,
} from '@/lib/tokens/columnPresetModel';
import { PULSE_COLUMN_ACCENT_DOT, type PulseColumnId } from '@/lib/utils/constants';
import { syntheticPulseFeedItems } from '@/lib/dev/demoPulseBundles';
import { dedupePulseBundlesByMint } from '@/lib/tokens/dedupePulseTokens';
import { fetchPulseFeedBundles } from '@/lib/tokens/fetchPulseFeedClient';
import { usePulseQuickBuy } from '@/lib/hooks/usePulseQuickBuy';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';
import { usePulseHiddenMintsStore, normalizePulseTwitterHandle } from '@/store/pulseHiddenMints';
import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { cn } from '@/lib/utils/cn';
import { usePulseColumnStore } from '@/store/pulseColumns';
import { useTradingStore } from '@/store/trading';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';
import { useUIStore } from '@/store/ui';
import { usePreferences } from '@/components/preferences/PreferencesProvider';
import type { AppChainId } from '@/lib/chains/appChain';
import type { PulseTokenBundle } from '@/types/tokens';

/**
 * Pulse row slot height per density mode. Both the virtualizer's
 * `estimateSize` and the absolute-positioned slot wrapper read from this so
 * Compact ↔ Tabled actually swap row footprint without re-mounting the list.
 *
 *  - `compact` — current multi-line layout (avatar + identity + social strip).
 *  - `tabled`  — Axiom-style denser footprint; same content but tighter.
 *
 * BNB Pulse rows reserve extra vertical space when an English gloss line can appear under CJK names.
 */
const ROW_SLOT_PX_BY_DENSITY = {
  compact: 138,
  /** Tabled + metric icon row — slightly taller for 28px capsules + PNG glyphs. */
  tabled: 116,
} as const;

const COLUMN_LABEL: Record<PulseColumnId, string> = {
  new: 'New',
  stretch: 'Stretch',
  migrated: 'Migrated',
};

/** Taller Pulse rows — page scroll lives on `<main>`; row height ≈ readability, not viewport÷6. */
export function PulseColumn({
  column,
  initialShare,
}: {
  column: PulseColumnId;
  initialShare?: ColumnPresetSharePayload | null;
}) {
  return <PulseColumnBody column={column} initialShare={initialShare} />;
}

function PulseColumnBody({
  column,
  initialShare,
}: {
  column: PulseColumnId;
  initialShare?: ColumnPresetSharePayload | null;
}) {
  const router = useRouter();
  const qc = useQueryClient();
  const uiDemo = useUiDemoMode();
  const { authenticated, getAccessToken } = usePointerAuth();
  const listMountRef = useRef<HTMLDivElement>(null);
  const scrollMainRef = useRef<Element | null>(null);
  const activeChain = useUIStore((s) => s.activeChain);
  const twitterRailSide = usePulseTwitterRailStore((s) => s.side);
  const cycleTwitterRail = usePulseTwitterRailStore((s) => s.cycleSide);
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [displayPopoverOpen, setDisplayPopoverOpen] = useState(false);
  const [guestDisplayPatch, setGuestDisplayPatch] = useState<Partial<ColumnDisplayOptions>>({});
  const displayPopoverRef = useRef<HTMLDivElement>(null);
  const shareAppliedRef = useRef(false);

  const buyButtonStyle = usePulseColumnStore((s) => s.byColumn[column].buyButtonStyle);
  const quickBuySol = usePulseColumnStore((s) => s.byColumn[column].quickBuySol);
  const quickBuyUsdc = usePulseColumnStore((s) => s.byColumn[column].quickBuyUsdc);
  const presetSlot = usePulseColumnStore((s) => s.byColumn[column].presetSlot);
  const setQuickBuySol = usePulseColumnStore((s) => s.setQuickBuySol);
  const setQuickBuyUsdc = usePulseColumnStore((s) => s.setQuickBuyUsdc);
  const setPresetSlot = usePulseColumnStore((s) => s.setPresetSlot);
  const setBuyButtonStyle = usePulseColumnStore((s) => s.setBuyButtonStyle);
  const spendAsset = useTradingStore((s) => s.spendAsset);

  const isUsdcQuickBuy = activeChain === 'sol' && spendAsset === 'usdc';
  const quickBuyAmount = isUsdcQuickBuy ? quickBuyUsdc : quickBuySol;
  const setQuickBuyAmount = isUsdcQuickBuy ? setQuickBuyUsdc : setQuickBuySol;

  const presetsQuery = useQuery({
    queryKey: ['pulse-column-presets', column],
    queryFn: async (): Promise<{ presets: ColumnPresetRowDto[] }> => {
      const token = await getAccessToken();
      if (!token) return { presets: [] };
      const r = await fetch(`/api/pulse/column-presets?column_id=${column}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        return { presets: [] };
      }
      return r.json() as Promise<{ presets: ColumnPresetRowDto[] }>;
    },
    enabled: authenticated,
    staleTime: 30_000,
  });

  const pulsePollingPaused = process.env.NEXT_PUBLIC_POINTER_PAUSE_POLLING === '1';
  const pulseRefetchMs = pulsePollingPaused
    ? false
    : Number(process.env.NEXT_PUBLIC_PULSE_REFETCH_MS ?? 15_000);

  const query = useQuery({
    queryKey: ['pulse', column, activeChain],
    queryFn: async (): Promise<{ items: PulseTokenBundle[]; fetchError: string | null }> => {
      try {
        const items = await fetchPulseFeedBundles(column, activeChain);
        return { items, fetchError: null };
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Feed unavailable';
        return { items: [], fetchError: message };
      }
    },
    staleTime: 1_000,
    refetchInterval: pulseRefetchMs,
    retry: 2,
  });

  const quoteSymbol = isUsdcQuickBuy ? 'USDC' : nativeTicker(activeChain);

  const feedItems = useMemo(() => {
    const raw = dedupePulseBundlesByMint(query.data?.items ?? []);
    /** Real indexer rows always win — demo deck only when API is empty and demo mode is on. */
    if (raw.length > 0) return raw;
    if (uiDemo && (query.data?.fetchError || raw.length === 0)) {
      return syntheticPulseFeedItems(column, activeChain);
    }
    return raw;
  }, [column, query.data?.items, query.data?.fetchError, uiDemo, activeChain]);

  const flashTrackPulseMint = useUIStore((s) => s.flashTrackPulseMint);

  useEffect(() => {
    const supabase = createClient();
    let refetchTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleBackgroundRefetch = () => {
      if (refetchTimer) return;
      refetchTimer = setTimeout(() => {
        refetchTimer = null;
        void qc.invalidateQueries({ queryKey: ['pulse', column, activeChain] });
      }, 800);
    };

    const channel = supabase
      .channel(`pulse:${column}:${activeChain}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tokens' },
        (payload) => {
          const row = payload.new as PulseTokenBundle['token'] | null;
          if (!row?.mint) return;
          const merged = mergeTokenIntoPulseCache(qc, column, activeChain, row);
          if (merged && column === 'new') flashTrackPulseMint(row.mint);
          scheduleBackgroundRefetch();
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tokens' },
        (payload) => {
          const row = payload.new as PulseTokenBundle['token'] | null;
          if (!row?.mint) return;
          mergeTokenIntoPulseCache(qc, column, activeChain, row);
          scheduleBackgroundRefetch();
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'token_market_snapshots' },
        (payload) => {
          const row = payload.new as PulseTokenBundle['snapshot'];
          if (!row?.mint) return;
          if (mergeSnapshotIntoPulseCache(qc, column, activeChain, row)) return;
          scheduleBackgroundRefetch();
        },
      )
      .subscribe();
    return () => {
      if (refetchTimer) clearTimeout(refetchTimer);
      void supabase.removeChannel(channel);
    };
  }, [column, activeChain, qc, flashTrackPulseMint]);

  useEffect(() => {
    listMountRef.current?.scrollTo({ top: 0 });
  }, [activeChain]);

  const fetchError = query.data?.fetchError ?? null;

  const { buyToken, sellTokenPct, busyMint } = usePulseQuickBuy();

  useEffect(() => {
    if (authenticated) setGuestDisplayPatch({});
  }, [authenticated]);

  useEffect(() => {
    if (!initialShare || initialShare.column_id !== column || shareAppliedRef.current) return;
    shareAppliedRef.current = true;
    void (async () => {
      if (authenticated) {
        try {
          const token = await getAccessToken();
          if (token) {
            const res = await fetch('/api/pulse/column-presets', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                column_id: initialShare.column_id,
                preset_slot: initialShare.preset_slot,
                name: initialShare.name,
                filters: initialShare.filters,
                display_options: initialShare.display_options,
                sort_by: initialShare.sort_by,
                sort_dir: initialShare.sort_dir,
              }),
            });
            if (res.ok) {
              void qc.invalidateQueries({ queryKey: ['pulse-column-presets', column] });
              toast.success('Shared preset applied');
            }
          }
        } catch {
          toast.error('Could not apply shared preset');
        }
      } else {
        toast.message('Sign in to save this shared preset');
      }
      setPresetSlot(column, initialShare.preset_slot);
      router.replace('/pulse');
    })();
  }, [
    initialShare,
    column,
    authenticated,
    getAccessToken,
    qc,
    router,
    setPresetSlot,
  ]);

  const activePresetRow = useMemo(() => {
    const list = presetsQuery.data?.presets ?? [];
    return list.find((p) => p.preset_slot === presetSlot) ?? null;
  }, [presetsQuery.data?.presets, presetSlot]);

  const normalizedFilters = useMemo(
    () =>
      activePresetRow && authenticated
        ? normalizeColumnFilters(activePresetRow.filters, activeChain)
        : defaultColumnFiltersForChain(activeChain),
    [activePresetRow, authenticated, activeChain],
  );

  const displayFromServer = useMemo(
    () =>
      activePresetRow && authenticated
        ? normalizeColumnDisplayOptions(activePresetRow.display_options)
        : DEFAULT_COLUMN_DISPLAY_OPTIONS,
    [activePresetRow, authenticated],
  );

  const displayCore = useMemo(
    () =>
      normalizeColumnDisplayOptions({
        ...displayFromServer,
        ...guestDisplayPatch,
      }),
    [displayFromServer, guestDisplayPatch],
  );

  const displayForRow = useMemo(
    (): ColumnDisplayOptions => ({
      ...displayCore,
      /** P1–P3 must not change Pulse row geometry — lock board layout to Axiom sizing. */
      density: 'normal',
      mcLayout: 'hero',
      buyButtonStyle,
    }),
    [displayCore, buyButtonStyle],
  );

  const displayOptionsSig =
    activePresetRow && authenticated
      ? JSON.stringify(activePresetRow.display_options ?? {})
      : '';

  useEffect(() => {
    if (!activePresetRow || !authenticated) return;
    const disp = normalizeColumnDisplayOptions(activePresetRow.display_options);
    setBuyButtonStyle(column, disp.buyButtonStyle);
    setQuickBuySol(column, disp.quickBuySol);
  }, [column, presetSlot, displayOptionsSig, activePresetRow, authenticated, setBuyButtonStyle, setQuickBuySol]);

  const sortBy: ColumnSortKey = useMemo(() => {
    const raw = activePresetRow?.sort_by;
    if (raw && COLUMN_SORT_KEYS.includes(raw as ColumnSortKey)) return raw as ColumnSortKey;
    return 'created_at';
  }, [activePresetRow?.sort_by]);

  const sortDir = activePresetRow?.sort_dir === 'asc' ? 'asc' : 'desc';

  const hiddenMints = usePulseHiddenMintsStore((s) => s.mints);
  const blacklistedDevs = usePulseHiddenMintsStore((s) => s.blacklistedDevs);
  const blacklistedTwitter = usePulseHiddenMintsStore((s) => s.blacklistedTwitter);

  const searchFiltered = useMemo(() => {
    const list = feedItems.filter((b) => {
      const mint = b.token.mint;
      if (hiddenMints.includes(mint)) return false;
      const creator = b.token.creator_wallet;
      if (creator && blacklistedDevs.includes(creator)) return false;
      const tw = normalizePulseTwitterHandle(b.token.twitter_handle);
      if (tw && blacklistedTwitter.includes(tw)) return false;
      return true;
    });
    const qq = search.trim().toLowerCase();
    if (!qq) return list;
    return list.filter((b) => {
      const sym = (b.token.symbol ?? '').toLowerCase();
      const name = (b.token.name ?? '').toLowerCase();
      return sym.includes(qq) || name.includes(qq);
    });
  }, [feedItems, search, hiddenMints, blacklistedDevs, blacklistedTwitter]);

  const columnFiltered = useMemo(
    () => searchFiltered.filter((b) => pulseBundleMatchesFilters(b, normalizedFilters, activeChain)),
    [searchFiltered, normalizedFilters, activeChain],
  );

  const visibleRows = useMemo(
    () => sortPulseBundles(columnFiltered, sortBy, sortDir),
    [columnFiltered, sortBy, sortDir],
  );

  const { prefs } = usePreferences();
  const isTabled = prefs.rowDensity === 'tabled';
  const rowSize =
    ROW_SLOT_PX_BY_DENSITY[prefs.rowDensity] + (activeChain === 'bnb' ? 14 : 0);

  /* eslint-disable react-hooks/incompatible-library */
  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => scrollMainRef.current as HTMLElement | null,
    estimateSize: () => rowSize,
    overscan: 10,
    /** Demo decks reuse mints across rows — index keeps keys unique for React + the virtualizer. */
    getItemKey: (index) => {
      const row = visibleRows[index];
      return row ? `${activeChain}:${row.token.mint}` : `${activeChain}:empty:${index}`;
    },
  });
  /* eslint-enable react-hooks/incompatible-library */

  useLayoutEffect(() => {
    // Each column scrolls its own row list (not the page <main>) so the three
    // columns scroll independently. Virtualizer reads measurements off this
    // element; fall back to documentElement for legacy/non-overflow cases.
    scrollMainRef.current = listMountRef.current ?? document.documentElement;
    rowVirtualizer.measure();
  }, [rowVirtualizer, column]);

  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowVirtualizer, visibleRows.length, rowSize, activeChain]);

  const trackPulseFlashMint = useUIStore((s) => s.trackPulseHighlightMint);
  useLayoutEffect(() => {
    const mint = trackPulseFlashMint?.trim();
    if (!mint || visibleRows.length === 0) return;
    const ix = visibleRows.findIndex((b) => b.token.mint === mint);
    if (ix < 0) return;
    rowVirtualizer.scrollToIndex(ix, { align: 'center' });
  }, [trackPulseFlashMint, visibleRows, rowVirtualizer]);

  const dotClass = PULSE_COLUMN_ACCENT_DOT[column];
  const title = COLUMN_LABEL[column];
  const effectiveBuyStyle = displayForRow.buyButtonStyle;

  if (query.isPending && query.data === undefined) {
    return <PulseColumnSkeleton column={column} />;
  }

  return (
    <section
      className={cn(
        // Bounded height + flex-col so the row list scrolls inside the column
        // independently of the page. min-h-0 lets the inner overflow region
        // shrink to fit; h-full anchors it to the parent's bounded box.
        // bg-bg-raised + border + rounded gives each column a grey "panel"
        // look against the darker page bg, so the gap between columns
        // reads as a real separation (Axiom-style, across all themes).
        'pulse-column flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-raised',
      )}
    >
      {/**
       * Header: brighter grey (`bg-bg-hover`) so it reads as a distinct band
       * above the row list — Axiom parity. Border-b separates it from rows.
       */}
      <header className="sticky top-0 z-[40] shrink-0 space-y-2 border-b border-white/[0.1] bg-bg-hover px-3 py-2 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.05),0_6px_12px_-8px_rgba(0,0,0,0.85)]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <span
              className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClass)}
              aria-hidden
            />
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-fg-primary">
              {title}
            </h2>
            {column === 'new' ? (
              <span className="text-[9px] tabular-nums text-fg-muted/80">&lt; 30m</span>
            ) : null}
            <button
              type="button"
              title={
                twitterRailSide === 'hidden'
                  ? 'Show X monitor'
                  : twitterRailSide === 'left'
                    ? 'Move X monitor right'
                    : 'Hide X monitor'
              }
              onClick={() => cycleTwitterRail()}
              className="btn-press focus-ring flex h-6 w-6 items-center justify-center rounded-sm border border-border-subtle text-fg-muted transition hover:bg-bg-hover hover:text-accent-primary"
            >
              <PanelsLeftRight className="h-3 w-3" strokeWidth={2.25} aria-hidden />
            </button>
          </div>

          {/**
           * Search is capped (`max-w-[14rem]`) so the inline quick-buy SOL
           * chip below has room — Axiom parity (search + amount enterer + chips).
           * Pill-rounded (`rounded-full`) to match Axiom's softer header inputs.
           */}
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol or name..."
            className={cn(
              'min-w-[100px] max-w-[14rem] flex-1 rounded-full border border-transparent px-3 py-1.5 text-[12px] text-fg-primary outline-none transition-all duration-150',
              'bg-white/5 placeholder:text-fg-muted/50 focus:border-transparent focus:bg-white/[0.08] focus:ring-1 focus:ring-accent-primary/25',
              'hover:border-white/15',
            )}
            aria-label={`Search ${title}`}
          />

          {/**
           * Quick-buy SOL amount enterer for this column. Bound to the
           * `quickBuySol` slot in `usePulseColumnStore`, so every Ultra / filled
           * button in this column's rows fires at this size. Number input keeps
           * mobile decimal keypad without the browser spinner.
           */}
          <label
            className={cn(
              'flex min-h-[2.125rem] shrink-0 items-center gap-1 rounded-full border border-transparent px-2.5 py-1.5 transition-all duration-150',
              'bg-white/5 hover:border-white/15 focus-within:border-transparent focus-within:bg-white/[0.08] focus-within:ring-1 focus-within:ring-accent-primary/25',
            )}
            title={`Quick-buy amount in ${quoteSymbol} for ${title}`}
          >
            <Zap
              className="h-3.5 w-3.5 shrink-0 fill-accent-primary/40 text-accent-primary"
              strokeWidth={2.4}
              aria-hidden
            />
            <input
              type="number"
              inputMode="decimal"
              step="0.1"
              min={0}
              value={Number.isFinite(quickBuyAmount) ? quickBuyAmount : 0}
              onChange={(e) => {
                const next = Number(e.target.value);
                setQuickBuyAmount(column, Number.isFinite(next) && next >= 0 ? next : 0);
              }}
              className="w-10 min-w-0 bg-transparent text-[12px] font-medium tabular-nums text-fg-primary outline-none placeholder:text-fg-muted [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label={`Quick-buy amount for ${title} in ${quoteSymbol}`}
            />
            {isUsdcQuickBuy ? (
              <QuoteTokenIcon kind="usdc" className="h-3.5 w-3.5 opacity-95" />
            ) : (
              <Image
                src={CHAIN_ICON_PNG[activeChain]}
                alt=""
                width={14}
                height={14}
                className="h-3.5 w-3.5 shrink-0 object-contain opacity-95"
                unoptimized
              />
            )}
          </label>

          <div className="flex shrink-0 items-center gap-0.5">
            {([1, 2, 3] as const).map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setPresetSlot(column, slot)}
                className={cn(
                  'btn-press focus-ring rounded-md border px-2 py-1 text-[10px] font-semibold leading-none transition',
                  presetSlot === slot
                    ? 'border-accent-primary/50 bg-accent-primary/10 text-accent-primary'
                    : 'border-border-subtle text-fg-muted hover:border-border-default hover:text-fg-secondary',
                )}
              >
                P{slot}
              </button>
            ))}

            <button
              type="button"
              onClick={() => setFilterOpen(true)}
              className="btn-press focus-ring flex h-8 w-8 items-center justify-center rounded-md text-fg-muted transition hover:bg-bg-hover hover:text-fg-secondary"
              aria-label="Column filters and sort"
            >
              <SlidersHorizontal className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      <ColumnFilterModal
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        columnId={column}
        presetSlot={presetSlot}
        row={activePresetRow}
        onSaved={() => {
          void presetsQuery.refetch();
        }}
      />

      {isTabled ? (
        <div
          className={cn(
            // Sub-header mirrors the main header tone so the whole top strip
            // reads as one band sitting above the row list.
            'shrink-0 border-b border-border-subtle bg-bg-hover px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted',
            'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3',
          )}
          aria-hidden
        >
          <span className="truncate">Token</span>
          <span className="flex items-center gap-4 tabular-nums">
            <span>Vol</span>
            <span>Mkt Cap</span>
            <span className="w-14 text-right">Buy</span>
          </span>
        </div>
      ) : null}

      <div
        ref={listMountRef}
        /**
         * Scroll/list region — same panel tier as the column (`bg-bg-raised`) so
         * empty space below the last row matches the theme; row cards lift via
         * `--bg-hover` in globals.css.
         */
        className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-bg-raised"
      >
        {fetchError && visibleRows.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="Feed unavailable"
            description={fetchError}
          />
        ) : visibleRows.length === 0 ? (
          <EmptyState
            icon={Activity}
            title={
              search.trim()
                ? 'No matches'
                : columnFiltered.length === 0 && searchFiltered.length > 0
                  ? 'No tokens match filters'
                  : 'Quiet on this column'
            }
            description={
              search.trim()
                ? 'Try a different query or clear search.'
                : columnFiltered.length === 0 && searchFiltered.length > 0
                  ? 'Open filters and relax criteria, or reset the preset.'
                  : 'New mints stream in here as they hit the indexed launchpads. Hold tight.'
            }
          />
        ) : (
          <div
            key={`${column}-${activeChain}-virtual`}
            className="relative w-full"
            style={{ height: rowVirtualizer.getTotalSize() }}
          >
            {rowVirtualizer.getVirtualItems().map((vi) => {
              const bundle = visibleRows[vi.index];
              if (!bundle) return null;
              const rowKey = `${activeChain}:${bundle.token.mint}`;
              return (
                <div
                  key={rowKey}
                  data-index={vi.index}
                  /**
                   * `overflow-visible` so Pulse strip hovers (above-trigger cards) aren't clipped inside the slot.
                   *
                   * Two z-index lifts work together so the dev / chart / crown popovers stay on top of
                   * the next row's content even when the cursor leaves the slot's visual box to travel
                   * down into the popup body:
                   *
                   *  - `hover:z-30` — lifts the slot while the cursor is anywhere over its row.
                   *  - `has-[[data-popover-open=true]]:z-30` — keeps it lifted while *any* descendant
                   *    `PulseRichHover` is open, even after the cursor moves off the trigger into the
                   *    floating popup (which sits outside the slot's hover bounds).
                   *
                   * Solid `bg-bg-raised` + `isolate` on the slot stops semi-transparent row cards
                   * from compositing through the row below when z-index shifts (ghost/double text).
                   */
                  className="absolute left-0 top-0 z-0 isolate w-full overflow-visible bg-bg-raised hover:z-30 has-[[data-popover-open=true]]:z-30"
                  style={{
                    transform: `translate3d(0, ${vi.start}px, 0)`,
                    height: rowSize,
                  }}
                >
                  <TokenRow
                    key={rowKey}
                    bundle={bundle}
                    density="normal"
                    display={displayForRow}
                    quickBuySol={quickBuyAmount}
                    buyButtonStyle={effectiveBuyStyle}
                    columnId={column}
                    slotHeight={rowSize}
                    quoteSymbol={quoteSymbol}
                    onPulseQuickBuy={() =>
                      void buyToken(bundle.token.mint, quickBuyAmount, {
                        spendAsset: isUsdcQuickBuy ? 'usdc' : 'sol',
                      })
                    }
                    onPulseSecondBuy={() =>
                      void buyToken(bundle.token.mint, displayForRow.secondQuickBuySol, {
                        spendAsset: isUsdcQuickBuy ? 'usdc' : 'sol',
                      })
                    }
                    onPulseQuickSell={() =>
                      void sellTokenPct(bundle.token.mint, displayForRow.secondSellPct)
                    }
                    pulseBuyBusy={busyMint === bundle.token.mint}
                    pulseBuyDisabled={busyMint !== null && busyMint !== bundle.token.mint}
                  />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
