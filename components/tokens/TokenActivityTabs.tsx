'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, BarChart3, ChevronUp, LayoutPanelTop, Settings, Table2, Workflow, X, Zap } from 'lucide-react';
import type { AppChainId } from '@/lib/chains/appChain';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { formatCompactUsd } from '@/lib/format';
import { formatNumber } from '@/lib/utils/formatters';
import { shortenAddress } from '@/lib/utils/addresses';
import { buildDeskFundingSynth, EMPTY_DESK_FUNDING } from '@/lib/tokens/holderDeskSynth';
import {
  tradeIsDeskSwap,
  tradeTraderHint,
  tradeRowMatchesDeskFilter,
  type TradesDeskFilter,
} from '@/lib/tokens/tradeFormatting';
import type { Tables } from '@/lib/supabase/types';
import type { DevWalletStatsRow } from '@/lib/db/wallets';
import { cn } from '@/lib/utils/cn';
import { ChainIcon } from '@/components/squads/ChainIcon';
import { HoldersTable } from '@/components/tokens/HoldersTable';
import { HoldersTableSettingsModal } from '@/components/tokens/HoldersTableSettingsModal';
import { BubbleMapPanel } from '@/components/tokens/BubbleMapPanel';
import { MintTradesTable } from '@/components/tokens/MintTradesTable';
import { TopTradersTable } from '@/components/tokens/TopTradersTable';
import { DevTokensPane } from '@/components/tokens/DevTokensPane';
import { EmptyState } from '@/components/shared/EmptyState';
import {
  formatDemoPositionUsd,
  syntheticCreatorDev,
  syntheticDevTokensForCreator,
  syntheticHoldersResponse,
  syntheticPositionsForMint,
  syntheticTradesForMint,
  syntheticTopTradersForMint,
} from '@/lib/dev/demoTokenFixtures';
import { preferTokenTableDemoRows } from '@/lib/dev/uiDemoMode';
import { demoTablesEnabled } from '@/lib/dev/demoPolicy';
import { isPointerQaMintClient } from '@/lib/qa/pointerQaMintClient';
import { useUiDemoMode } from '@/lib/hooks/useUiDemoMode';
import { useTrackedWalletsLookup } from '@/lib/hooks/useTrackedWalletsLookup';
import { useMintTrades } from '@/lib/hooks/useMintTrades';
import { useWalletLabels } from '@/lib/hooks/useWalletLabels';
import type { MintTopTraderRow } from '@/lib/trading/mintTopTraders';
import type { TraderDeskFilter } from '@/lib/walletIdentity/traderFilters';
import { traderRowMatchesFilter, TRADER_FILTER_OPTIONS } from '@/lib/walletIdentity/traderFilters';
import { useUIStore } from '@/store/ui';
import { DeskFilterPill } from '@/components/tokens/cells/DeskFilterPill';
import { TradesDeskFilterPill } from '@/components/tokens/cells/TradesDeskFilterPill';
import {
  DESK_CELL_CLASS,
  DESK_CELL_FIRST_CLASS,
  DESK_HEADER_CLASS,
  DESK_HEADER_NUM_CLASS,
  deskRowClass,
  DESK_SCROLL_WELL_CLASS,
  DESK_STICKY_HEAD_CLASS,
  DESK_TABLE_CLASS,
} from '@/components/tokens/cells/deskTokens';
import { useActiveWalletStore } from '@/store/activeWallet';
import {
  useTokenPageLayoutStore,
  MIN_BUBBLE_MAP_W,
  MAX_BUBBLE_MAP_W,
} from '@/store/tokenPageLayout';

/** Rough native/USD for converting USD notionals in the “native units” column toggle (UI preview). */
const NATIVE_USD_HINT: Record<AppChainId, number> = {
  sol: 210,
  eth: 3200,
  ton: 5.5,
  bnb: 650,
  base: 3200,
};

type TabId = 'trades' | 'positions' | 'orders' | 'holders' | 'traders' | 'dev_tokens';

type TradeRow = Tables<'trades'>;

// Note: the holder bubble map is NOT a tab — it's a drag-resizable slide-out
// (Axiom-style) toggled from the toolbar, so it overlays the active table
// instead of taking a full tab of its own.
const TABS: { id: TabId; label: string }[] = [
  { id: 'trades', label: 'Trades' },
  { id: 'positions', label: 'Positions' },
  { id: 'orders', label: 'Orders' },
  { id: 'holders', label: 'Holders' },
  { id: 'traders', label: 'Top Traders' },
  { id: 'dev_tokens', label: 'Dev Tokens' },
];

function MintTradesScroll({
  rows,
  mint,
  tokenSymbol,
  creatorWallet,
  supplyTokens,
  marketCapUsd,
  nativeSym,
  displayMode,
  mcDisplay,
  onHoverChange,
  onFilterMintTrades,
  tradesMakerFilter,
  onToggleTotalDisplayMode,
  onToggleMcDisplay,
  ageSortDir,
  onAgeSortDirChange,
  ageDisplay,
  onAgeDisplayChange,
  viewerWallet = null,
}: {
  rows: TradeRow[];
  mint: string;
  tokenSymbol: string;
  creatorWallet: string | null;
  supplyTokens?: number | null;
  marketCapUsd?: number | null;
  nativeSym: string;
  displayMode: 'USD' | 'SOL';
  mcDisplay: 'mc' | 'price';
  onHoverChange: (paused: boolean) => void;
  onFilterMintTrades?: (address: string) => void;
  tradesMakerFilter?: string | null;
  onToggleTotalDisplayMode?: () => void;
  onToggleMcDisplay?: () => void;
  ageSortDir: 'asc' | 'desc';
  onAgeSortDirChange: (dir: 'asc' | 'desc') => void;
  ageDisplay: 'age' | 'time';
  onAgeDisplayChange: (mode: 'age' | 'time') => void;
  viewerWallet?: string | null;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [showBackTop, setShowBackTop] = useState(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const onScroll = () => setShowBackTop(el.scrollTop > 120);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [rows.length]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col bg-desk-panel">
      <div
        ref={scrollRef}
        className={cn('desk-scroll-well w-full min-w-0 bg-desk-panel', DESK_SCROLL_WELL_CLASS)}
        onPointerEnter={() => onHoverChange(true)}
        onPointerLeave={() => onHoverChange(false)}
      >
        <MintTradesTable
          rows={rows}
          mint={mint}
          tokenSymbol={tokenSymbol}
          creatorWallet={creatorWallet}
          supplyTokens={supplyTokens}
          marketCapUsd={marketCapUsd}
          totalDisplayMode={displayMode}
          mcDisplay={mcDisplay}
          nativeSym={nativeSym}
          onFilterMintTrades={onFilterMintTrades}
          tradesMakerFilter={tradesMakerFilter}
          onToggleTotalDisplayMode={onToggleTotalDisplayMode}
          onToggleMcDisplay={onToggleMcDisplay}
          ageSortDir={ageSortDir}
          onAgeSortDirChange={onAgeSortDirChange}
          ageDisplay={ageDisplay}
          onAgeDisplayChange={onAgeDisplayChange}
          viewerWallet={viewerWallet}
        />
      </div>
      {showBackTop ? (
        <button
          type="button"
          className="pointer-events-auto absolute bottom-3 right-3 z-10 flex items-center gap-1 rounded-full border border-border-subtle bg-bg-raised/95 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-fg-secondary shadow-md backdrop-blur-sm transition hover:border-border-default hover:text-fg-primary"
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <ChevronUp className="h-3 w-3" strokeWidth={2} aria-hidden />
          Top
        </button>
      ) : null}
    </div>
  );
}

function PlaceholderTab({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[10rem] flex-col items-center justify-center gap-2 px-6 py-10 text-center">
      <p className="text-[12px] font-semibold text-fg-primary">{title}</p>
      <p className="max-w-sm text-[11px] leading-relaxed text-fg-muted">{body}</p>
    </div>
  );
}

function DeskEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="flex min-h-[10rem] flex-1 flex-col items-center justify-center gap-1.5 px-6 py-10 text-center">
      <p className="text-[12px] font-semibold text-fg-primary">{title}</p>
      <p className="max-w-sm text-[11px] leading-relaxed text-fg-muted">{body}</p>
    </div>
  );
}

/** Positions desk — demo rows in uiDemo only; live shows empty state until wallet-scoped positions API ships. */
function PositionsDesk({ sym, mint, demoTables }: { sym: string; mint: string; demoTables: boolean }) {
  const rows = useMemo(
    () => (demoTables ? syntheticPositionsForMint(sym, mint) : []),
    [sym, mint, demoTables],
  );

  if (rows.length === 0) {
    return (
      <DeskEmptyState
        title="No open positions"
        body="Buy this token from the panel on the right — your positions and PnL will show here."
      />
    );
  }

  const cols = ['Token', 'Bought', 'Sold', 'Remaining', 'PnL', 'Actions'] as const;
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', DESK_SCROLL_WELL_CLASS)}>
      <table className={cn('w-full min-w-[640px] border-collapse text-left', DESK_TABLE_CLASS)}>
        <thead className={DESK_STICKY_HEAD_CLASS}>
          <tr>
            {cols.map((name) => (
              <th
                key={name}
                className={name === 'Token' ? DESK_HEADER_CLASS : DESK_HEADER_NUM_CLASS}
              >
                {name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => {
            const pnlTone =
              row.pnlUsd > 0 ? 'text-signal-bull' : row.pnlUsd < 0 ? 'text-signal-bear' : 'text-fg-muted';
            return (
              <tr key={i} className={deskRowClass(i)}>
                <td className={cn(DESK_CELL_FIRST_CLASS, 'text-[12px] font-semibold text-fg-primary')}>
                  {row.token}
                </td>
                <td className={cn(DESK_CELL_CLASS, 'text-right text-[12px] text-fg-secondary')}>
                  {formatDemoPositionUsd(row.boughtUsd)}
                </td>
                <td className={cn(DESK_CELL_CLASS, 'text-right text-[12px] text-fg-secondary')}>
                  {formatDemoPositionUsd(row.soldUsd)}
                </td>
                <td className={cn(DESK_CELL_CLASS, 'text-right text-[12px] text-fg-primary')}>
                  {formatDemoPositionUsd(row.remainingUsd)}
                </td>
                <td className={cn(DESK_CELL_CLASS, 'text-right text-[12px] font-semibold', pnlTone)}>
                  {row.pnlUsd >= 0 ? '+' : ''}
                  {formatDemoPositionUsd(row.pnlUsd)}
                </td>
                <td className={cn(DESK_CELL_CLASS, 'text-right')}>
                  <button
                    type="button"
                    className="btn-press text-[10px] font-semibold uppercase tracking-wide text-fg-muted transition hover:text-fg-primary"
                  >
                    Close
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OrdersDesk({ sym, demoTables }: { sym: string; demoTables: boolean }) {
  if (!demoTables) {
    return (
      <DeskEmptyState
        title="No active orders"
        body="Set a Limit, TWAP, or Stop from the Buy panel — your open orders for this token will appear here."
      />
    );
  }

  const types = ['Limit', 'TWAP', 'Limit', 'Stop'] as const;

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col overflow-hidden', DESK_SCROLL_WELL_CLASS)}>
      <table className={cn('w-full min-w-[780px] border-collapse text-left', DESK_TABLE_CLASS)}>
        <thead className={DESK_STICKY_HEAD_CLASS}>
          <tr>
            <th className={DESK_HEADER_CLASS}>Token</th>
            <th className={DESK_HEADER_CLASS}>Type</th>
            <th className={DESK_HEADER_NUM_CLASS}>Amount</th>
            <th className={DESK_HEADER_NUM_CLASS}>Current MC</th>
            <th className={DESK_HEADER_NUM_CLASS}>Target MC</th>
            <th className={DESK_HEADER_NUM_CLASS}>Settings</th>
            <th className={DESK_HEADER_NUM_CLASS}>Action</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 14 }, (_, i) => {
            const side = i % 2 === 0 ? 'Buy' : 'Sell';
            return (
              <tr key={i} className={deskRowClass(i)}>
                <td className={cn(DESK_CELL_FIRST_CLASS, 'text-[12px] font-semibold text-fg-primary')}>
                  {sym}
                </td>
                <td className={cn(DESK_CELL_CLASS, 'text-[12px] text-fg-secondary')}>
                  {types[i % types.length]}
                </td>
                <td className={cn(DESK_CELL_CLASS, 'text-right text-[12px] text-fg-primary')}>
                  {(1.8 + i * 0.31).toFixed(2)} {sym}
                </td>
                <td className={cn(DESK_CELL_CLASS, 'text-right text-[12px] text-fg-secondary')}>
                  {formatCompactUsd(1_200_000 + i * 80_000)}
                </td>
                <td className={cn(DESK_CELL_CLASS, 'text-right text-[12px] text-fg-secondary')}>
                  {formatCompactUsd(2_400_000 + i * 50_000)}
                </td>
                <td className={cn(DESK_CELL_CLASS, 'text-right')}>
                  <span className="inline-block h-2 w-8 rounded bg-fg-muted/15" title="Preview" />
                </td>
                <td
                  className={cn(
                    DESK_CELL_CLASS,
                    'text-right text-[11px] font-semibold',
                    side === 'Buy' ? 'text-signal-bull' : 'text-signal-bear',
                  )}
                >
                  {side}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function TokenActivityTabs({
  mint,
  symbol,
  creatorWallet,
  dev,
  tradesPanel,
  onTradesPanelChange,
  tradesDeskFilter,
  onTradesDeskFilterChange,
  tradesAgeSortDir,
  onTradesAgeSortDirChange,
  tradesAgeDisplay,
  onTradesAgeDisplayChange,
  onLiveTradesSnapshot,
  onOpenInstantTrade,
  instantTradeOpen = false,
  forceDemoTables = false,
  supplyTokens = null,
  marketCapUsd = null,
}: {
  mint: string;
  symbol: string | null;
  creatorWallet: string | null;
  dev: DevWalletStatsRow | null;
  tradesPanel: boolean;
  onTradesPanelChange: (v: boolean) => void;
  tradesDeskFilter: TradesDeskFilter;
  onTradesDeskFilterChange: (filter: TradesDeskFilter) => void;
  tradesAgeSortDir: 'asc' | 'desc';
  onTradesAgeSortDirChange: (dir: 'asc' | 'desc') => void;
  tradesAgeDisplay: 'age' | 'time';
  onTradesAgeDisplayChange: (mode: 'age' | 'time') => void;
  onLiveTradesSnapshot?: (s: { rows: TradeRow[]; isLoading: boolean }) => void;
  onOpenInstantTrade?: () => void;
  instantTradeOpen?: boolean;
  /** Stock detail surfaces — populate desks with layout demo rows without global ui demo. */
  forceDemoTables?: boolean;
  supplyTokens?: number | null;
  marketCapUsd?: number | null;
}) {
  const [tab, setTab] = useState<TabId>('trades');
  const visibleTabs = useMemo(
    () => (tradesPanel ? TABS.filter((t) => t.id !== 'trades') : TABS),
    [tradesPanel],
  );

  // Holder bubble map — Axiom-style drag-resizable slide-out (NOT a tab). Toggled
  // from the toolbar; overlays the active table on the right; width persists.
  const [bubblesOpen, setBubblesOpen] = useState(false);
  const bubbleMapW = useTokenPageLayoutStore((s) => s.bubbleMapW);
  const setBubbleMapW = useTokenPageLayoutStore((s) => s.setBubbleMapW);
  const bubbleDragRef = useRef<{ startX: number; startW: number } | null>(null);
  const onBubbleResizeDown = (e: React.PointerEvent) => {
    e.preventDefault();
    bubbleDragRef.current = { startX: e.clientX, startW: bubbleMapW };
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
  };
  const onBubbleResizeMove = (e: React.PointerEvent) => {
    const s = bubbleDragRef.current;
    if (!s) return;
    // Dragging the left edge leftward (clientX shrinks) widens the panel.
    const next = Math.min(MAX_BUBBLE_MAP_W, Math.max(MIN_BUBBLE_MAP_W, s.startW + (s.startX - e.clientX)));
    setBubbleMapW(next);
  };
  const onBubbleResizeUp = (e: React.PointerEvent) => {
    bubbleDragRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
  };
  const [tradesFeedHoverPause, setTradesFeedHoverPause] = useState(false);
  const [onlyTracked, setOnlyTracked] = useState(false);
  const [traderDeskFilter, setTraderDeskFilter] = useState<TraderDeskFilter>('all');
  const [holderDeskFilter, setHolderDeskFilter] = useState<TraderDeskFilter>('all');
  const [tableUsd, setTableUsd] = useState(false);
  const [tradesMcDisplay, setTradesMcDisplay] = useState<'mc' | 'price'>('mc');
  const uiDemo = useUiDemoMode();
  const { isTracked } = useTrackedWalletsLookup();
  const { resolveLabel } = useWalletLabels();
  const activeChain = useUIStore((s) => s.activeChain);
  const nativeSym = nativeTicker(activeChain);
  const nativeUsdHint = NATIVE_USD_HINT[activeChain];
  const sym = symbol ?? 'TOK';
  const qaLive = isPointerQaMintClient(mint);
  const tableDemoEnv = qaLive ? false : preferTokenTableDemoRows() || forceDemoTables;
  const demoTables = qaLive ? false : demoTablesEnabled(uiDemo) || forceDemoTables;
  const demoTrades = useMemo(() => syntheticTradesForMint(mint), [mint]);
  const demoTraders = useMemo(() => syntheticTopTradersForMint(mint), [mint]);
  const demoHolders = useMemo(() => syntheticHoldersResponse(mint, 9), [mint]);
  const effectiveDevCount =
    dev?.tokens_launched ??
    (creatorWallet && demoTables ? syntheticCreatorDev(creatorWallet).tokens_launched : 0);

  const [traderPnlSortDir, setTraderPnlSortDir] = useState<'asc' | 'desc' | null>(null);
  const [tradesMakerFilter, setTradesMakerFilter] = useState<string | null>(null);
  const [holdersSettingsOpen, setHoldersSettingsOpen] = useState(false);
  const activeWalletAddress = useActiveWalletStore((s) => s.activeWalletAddress);

  const handleFilterMintTrades = (address: string) => {
    setTradesMakerFilter(address);
    onTradesDeskFilterChange('all');
    if (tradesPanel) onTradesPanelChange(false);
    setTab('trades');
  };

  const toggleTradesPanelLayout = () => {
    if (tradesPanel) {
      onTradesPanelChange(false);
      setTab('trades');
      return;
    }
    onTradesPanelChange(true);
    if (tab === 'trades') setTab('positions');
  };

  const handleClearTradesMakerFilter = () => {
    setTradesMakerFilter(null);
  };

  const handleClearTradesDeskFilter = () => {
    onTradesDeskFilterChange('all');
  };

  const toggleTradesDeskFilter = (id: Exclude<TradesDeskFilter, 'all'>) => {
    setTradesMakerFilter(null);
    onTradesDeskFilterChange(tradesDeskFilter === id ? 'all' : id);
  };

  const tradesFeedActive = tab === 'trades' || tradesPanel;
  const tradesQ = useMintTrades(mint, {
    enabled: tradesFeedActive,
    placeholderData: demoTables ? { trades: demoTrades } : undefined,
    staleTime: 15_000,
    refetchInterval: tradesFeedActive && !tradesFeedHoverPause ? 4500 : false,
    refetchOnWindowFocus: tradesFeedActive ? !tradesFeedHoverPause : true,
  });

  const tradersQ = useQuery({
    queryKey: ['mint-top-traders', mint, 'chain'],
    queryFn: async () => {
      // Always read from the chain-top-traders endpoint — it returns empty
      // + label "indexer_pending" for mints without indexed swaps. Desk
      // surfaces an honest "no indexer data" message in that case.
      const r = await fetch(
        `/api/tokens/${encodeURIComponent(mint)}/chain-top-traders?limit=25`,
      );
      if (!r.ok) throw new Error('traders');
      return r.json() as Promise<{
        traders: MintTopTraderRow[];
        source?: string;
        label?: string;
      }>;
    },
    enabled: tab === 'traders',
    placeholderData: demoTables ? { traders: demoTraders } : undefined,
    staleTime: 30_000,
  });

  const indexerStatusQ = useQuery({
    queryKey: ['mint-index-status', mint],
    queryFn: async () => {
      const r = await fetch(
        `/api/indexer/mint-status?mint=${encodeURIComponent(mint)}`,
      );
      if (!r.ok) return null;
      return r.json() as Promise<{
        status: { status: string; swap_count: number | null } | null;
      }>;
    },
    enabled: Boolean(mint),
    staleTime: 30_000,
  });

  const holdersQ = useQuery({
    queryKey: ['token-holders', mint],
    queryFn: async () => {
      const r = await fetch(`/api/tokens/${encodeURIComponent(mint)}/holders`);
      if (!r.ok) throw new Error('holders_failed');
      return r.json() as Promise<{
        holders: { id: number }[];
        holderCountTotal?: number | null;
      }>;
    },
    enabled: tab === 'holders',
    placeholderData: demoTables ? demoHolders : undefined,
    staleTime: 60_000,
  });

  const tradeRowsRaw = useMemo((): TradeRow[] => {
    const raw = tradesQ.data?.trades ?? [];
    if (tableDemoEnv || (uiDemo && (raw.length === 0 || tradesQ.isError))) return demoTrades;
    return raw.filter(tradeIsDeskSwap);
  }, [tradesQ.data?.trades, tradesQ.isError, uiDemo, tableDemoEnv, demoTrades]);

  const tradeRowsForTable = useMemo((): TradeRow[] => {
    let base = tradeRowsRaw;

    if (tradesMakerFilter) {
      return base.filter((row, i) => tradeTraderHint(row, i).fullAddress === tradesMakerFilter);
    }

    if (tradesDeskFilter !== 'all') {
      return base.filter((row, i) => {
        const wallet = tradeTraderHint(row, i).fullAddress;
        return tradeRowMatchesDeskFilter({
          wallet,
          creatorWallet,
          tracked: wallet ? isTracked(wallet) : false,
          userWallet: activeWalletAddress,
          filter: tradesDeskFilter,
        });
      });
    }

    return base;
  }, [
    tradeRowsRaw,
    tradesMakerFilter,
    tradesDeskFilter,
    creatorWallet,
    isTracked,
    activeWalletAddress,
  ]);

  useEffect(() => {
    onLiveTradesSnapshot?.({
      rows: tradeRowsRaw,
      isLoading: tradesQ.isLoading,
    });
  }, [tradeRowsRaw, tradesQ.isLoading, onLiveTradesSnapshot]);

  useEffect(() => {
    if (tab !== 'trades') setTradesFeedHoverPause(false);
  }, [tab]);

  useEffect(() => {
    if (tradesPanel && tab === 'trades') setTab('positions');
  }, [tradesPanel, tab]);

  const displayMode: 'USD' | 'SOL' = tableUsd ? 'USD' : 'SOL';

  /** True when the chain indexer has no rows for this mint yet. */
  const indexerPending =
    (tradersQ.data?.label === 'indexer_pending' || tradesQ.data?.label === 'indexer_pending') &&
    (tradersQ.data?.traders?.length ?? 0) === 0 &&
    (tradesQ.data?.trades?.length ?? 0) === 0;

  const traderRowsAfterTrack = useMemo((): MintTopTraderRow[] => {
    const raw = tradersQ.data?.traders ?? [];
    const rows =
      tableDemoEnv || (uiDemo && (raw.length === 0 || tradersQ.isError))
        ? demoTraders
        : raw;
    return onlyTracked ? rows.filter((w) => isTracked(w.wallet_address)) : rows;
  }, [
    tradersQ.data?.traders,
    tradersQ.isError,
    uiDemo,
    tableDemoEnv,
    demoTraders,
    onlyTracked,
    isTracked,
  ]);

  const filteredTraders = useMemo((): MintTopTraderRow[] => {
    const allowDemo = tableDemoEnv || demoTables;
    return traderDeskFilter === 'all'
      ? traderRowsAfterTrack
      : traderRowsAfterTrack.filter((w) =>
          traderRowMatchesFilter({
            row: w,
            chain: activeChain,
            creatorWallet,
            tracked: isTracked(w.wallet_address),
            labelDisp: resolveLabel(w.wallet_address, 5),
            filter: traderDeskFilter,
            allowDemoDirectory: allowDemo,
          }),
        );
  }, [
    traderRowsAfterTrack,
    traderDeskFilter,
    creatorWallet,
    resolveLabel,
    isTracked,
    activeChain,
    tableDemoEnv,
    demoTables,
  ]);

  const sortedTraders = useMemo(() => {
    const withFunding = filteredTraders.map((row) => ({
      ...row,
      funding: demoTables
        ? buildDeskFundingSynth(row.wallet_address, mint)
        : EMPTY_DESK_FUNDING,
    }));
    if (!traderPnlSortDir) return withFunding;
    return [...withFunding].sort((a, b) => {
      const diff = (a.realized_pnl_usd ?? 0) - (b.realized_pnl_usd ?? 0);
      return traderPnlSortDir === 'asc' ? diff : -diff;
    });
  }, [filteredTraders, traderPnlSortDir, mint, demoTables]);

  const handleSortPnL = () => {
    setTraderPnlSortDir((d) => (d === null ? 'desc' : d === 'desc' ? 'asc' : null));
  };

  const devTokens = useMemo(() => {
    if (!creatorWallet) return [];
    if (!demoTables) return [];
    return syntheticDevTokensForCreator(creatorWallet, mint);
  }, [creatorWallet, mint, demoTables]);

  const qaMint = isPointerQaMintClient(mint);
  const devTokensLiveQ = useQuery({
    queryKey: ['dev-tokens-live', mint],
    queryFn: async () => {
      const r = await fetch(`/api/tokens/${encodeURIComponent(mint)}/dev-tokens`);
      if (!r.ok) throw new Error('dev_tokens');
      return r.json() as Promise<{
        tokens: Array<{
          mint: string;
          symbol: string | null;
          name: string | null;
          created_at: string;
          migrated_at: string | null;
          market_cap_usd: number | null;
          volume_24h_usd: number | null;
          is_current: boolean;
        }>;
      }>;
    },
    enabled: qaMint && tab === 'dev_tokens' && Boolean(creatorWallet),
    staleTime: 60_000,
  });

  const devTokensForPane = useMemo(() => {
    if (qaMint && devTokensLiveQ.data?.tokens?.length) {
      /** Live rows: unknown metrics are null (render `—`), never recycled MC/zeros. */
      return devTokensLiveQ.data.tokens.map((t) => ({
        mint: t.mint,
        symbol: t.symbol ?? '—',
        name: t.name ?? t.symbol ?? 'Token',
        mcUsd: Number(t.market_cap_usd) || 0,
        athUsd: null,
        liquidityUsd: null,
        volume24hUsd:
          t.volume_24h_usd != null && Number.isFinite(Number(t.volume_24h_usd))
            ? Number(t.volume_24h_usd)
            : null,
        balanceUsd: null,
        pnlUsd: null,
        migrated: Boolean(t.migrated_at),
        dex: t.migrated_at ? 'raydium' : null,
        status: (t.migrated_at ? 'mooned' : 'active') as 'active' | 'mooned' | 'rugged',
        launchedAt: t.created_at,
      }));
    }
    return devTokens;
  }, [qaMint, devTokensLiveQ.data?.tokens, devTokens]);

  const effectiveDevCountLive =
    qaMint && devTokensLiveQ.data?.tokens?.length
      ? devTokensLiveQ.data.tokens.length
      : effectiveDevCount;

  const tradersEmpty = sortedTraders.length === 0 && !tradersQ.isLoading;
  const tradersLensEmpty =
    traderDeskFilter !== 'all' && traderRowsAfterTrack.length > 0 && filteredTraders.length === 0;

  const showTableControls = tab === 'traders' || tab === 'trades' || tab === 'holders';

  const tabLabel = (t: (typeof TABS)[number]) => {
    if (t.id === 'holders') {
      /** Total holders (Moralis/GPA), never the top-N rows loaded for the table. */
      const total = holdersQ.data?.holderCountTotal;
      if (total != null && total > 0) return `Holders (${formatNumber(total, { compact: total >= 10_000 })})`;
      return 'Holders';
    }
    if (t.id === 'traders') {
      const n = traderRowsAfterTrack.length;
      if (n > 0) return `Top Traders (${n})`;
      return 'Top Traders';
    }
    if (t.id === 'dev_tokens' && effectiveDevCountLive > 0) {
      return `Dev Tokens (${effectiveDevCountLive})`;
    }
    return t.label;
  };

  const showDeskSettings = tab === 'holders' || tab === 'traders';
  const showDeskFilters = tab === 'traders' || tab === 'holders';
  const activeDeskFilter = tab === 'holders' ? holderDeskFilter : traderDeskFilter;
  const setActiveDeskFilter =
    tab === 'holders' ? setHolderDeskFilter : setTraderDeskFilter;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-desk-panel font-sans text-[12px] leading-snug text-fg-primary antialiased">
      <div className="flex shrink-0 items-center gap-1 border-b border-border-subtle/25 px-2 py-0.5">
        <nav className="flex shrink-0 items-center gap-0" aria-label="Token activity">
          {visibleTabs.map((t) => {
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={cn(
                  'btn-press relative inline-flex h-7 items-center px-2.5 text-[11px] font-semibold tracking-tight transition-colors',
                  active ? 'text-fg-primary' : 'text-fg-muted hover:text-fg-secondary',
                )}
                aria-current={active ? 'page' : undefined}
              >
                {active ? (
                  <span className="absolute inset-x-1.5 bottom-0 h-0.5 rounded-sm bg-accent-primary" />
                ) : null}
                <span className="relative z-[1]">{tabLabel(t)}</span>
              </button>
            );
          })}
        </nav>

        {tab === 'trades' ? (
          <div className="ml-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto border-l border-border-subtle/40 pl-1.5 [scrollbar-width:none]">
            <TradesDeskFilterPill
              id="dev"
              label="Dev"
              active={tradesDeskFilter === 'dev'}
              onClick={() => toggleTradesDeskFilter('dev')}
            />
            <TradesDeskFilterPill
              id="tracked"
              label="Tracked"
              active={tradesDeskFilter === 'tracked'}
              onClick={() => toggleTradesDeskFilter('tracked')}
            />
            <TradesDeskFilterPill
              id="you"
              label="You"
              active={tradesDeskFilter === 'you'}
              onClick={() => toggleTradesDeskFilter('you')}
            />
          </div>
        ) : showDeskFilters ? (
          <div className="ml-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto border-l border-border-subtle/40 pl-1.5 [scrollbar-width:none]">
            {TRADER_FILTER_OPTIONS.map(({ id, label }) => (
              <DeskFilterPill
                key={id}
                active={activeDeskFilter === id}
                onClick={() => setActiveDeskFilter(id)}
              >
                {label}
              </DeskFilterPill>
            ))}
          </div>
        ) : (
          <div className="flex-1" />
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1.5 py-0.5">
          <button
            type="button"
            onClick={() => setBubblesOpen((o) => !o)}
            aria-pressed={bubblesOpen}
            className={cn(
              'btn-press inline-flex h-6 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold transition-colors',
              bubblesOpen
                ? 'border-accent-primary/50 bg-accent-primary/10 text-fg-primary'
                : 'border-border-subtle text-fg-secondary hover:bg-bg-hover hover:text-fg-primary',
            )}
            title="Holder bubble map"
          >
            <Workflow className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
            <span className="hidden sm:inline">Bubble map</span>
          </button>
          {tab === 'orders' ? (
            <button
              type="button"
              className="btn-press h-6 px-1 text-[11px] font-semibold text-signal-bear/90 transition hover:text-signal-bear"
              onClick={() => {
                /* reserved for orderbook cancel-all API */
              }}
            >
              Cancel all
            </button>
          ) : null}
          {tab === 'traders' || tab === 'holders' ? (
            <button
              type="button"
              onClick={() => setOnlyTracked((o) => !o)}
              className={cn(
                'btn-press inline-flex h-6 items-center rounded-md px-2.5 text-[11px] font-medium transition-colors',
                onlyTracked
                  ? 'bg-bg-hover text-fg-primary'
                  : 'text-fg-muted hover:text-fg-primary',
              )}
            >
              Only Tracked
            </button>
          ) : null}
          {tab === 'trades' && tradesFeedHoverPause ? (
            <span className="inline-flex h-6 items-center rounded-md border border-signal-info/35 bg-signal-info/10 px-2 text-[10px] font-semibold uppercase tracking-wide text-signal-info">
              Paused
            </span>
          ) : null}
          {tradesPanel || tab === 'trades' ? (
            <button
              type="button"
              onClick={toggleTradesPanelLayout}
              className={cn(
                'btn-press inline-flex h-6 items-center gap-1 rounded-md border px-2 text-[11px] font-semibold transition-colors duration-200',
                tradesPanel
                  ? 'border-border-subtle bg-bg-hover text-fg-primary'
                  : 'border-border-subtle/80 text-fg-muted hover:border-border-default hover:text-fg-primary',
              )}
              title={
                tradesPanel
                  ? 'Show full trades table below the chart'
                  : 'Show compact live feed beside the chart'
              }
            >
              {tradesPanel ? (
                <>
                  <Table2 className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                  Trades Table
                </>
              ) : (
                <>
                  <LayoutPanelTop className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
                  Trades Panel
                </>
              )}
            </button>
          ) : null}
          {showTableControls && tab !== 'trades' ? (
            <>
              <button
                type="button"
                onClick={() => setTableUsd((u) => !u)}
                className={cn(
                  'btn-press inline-flex h-6 items-center gap-1 rounded-md px-2.5 text-[11px] font-semibold tabular-nums transition-colors',
                  tableUsd
                    ? 'bg-bg-hover text-fg-primary'
                    : 'text-fg-muted hover:text-fg-primary',
                )}
                title="Toggle USD / SOL"
              >
                {tableUsd ? (
                  'USD'
                ) : (
                  <>
                    {nativeSym}
                    <ChainIcon chain="sol" size={12} />
                  </>
                )}
              </button>
            </>
          ) : null}
          {onOpenInstantTrade ? (
            <button
              type="button"
              onClick={onOpenInstantTrade}
              aria-pressed={instantTradeOpen}
              className={cn(
                'btn-press focus-ring inline-flex h-6 items-center gap-1.5 rounded-md px-2.5 text-[11px] font-semibold tracking-tight shadow-sm transition',
                instantTradeOpen
                  ? 'bg-bg-sunken text-accent-primary ring-1 ring-accent-primary/45 hover:bg-bg-hover'
                  : 'bg-accent-primary text-fg-inverse hover:brightness-110',
              )}
            >
              <Zap className="h-3 w-3 shrink-0" strokeWidth={2} aria-hidden />
              Instant Trade
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              if (showDeskSettings) setHoldersSettingsOpen(true);
            }}
            disabled={!showDeskSettings}
            className={cn(
              'btn-press inline-flex h-6 w-6 items-center justify-center rounded-md text-fg-muted/40 transition-colors hover:text-fg-primary',
              !showDeskSettings && 'pointer-events-none opacity-30',
            )}
            aria-label="Table settings"
          >
            <Settings className="h-3 w-3" strokeWidth={2} />
          </button>
        </div>
      </div>
      <div className="relative flex min-h-0 flex-1 flex-col overflow-hidden w-full">
        {tab === 'trades' && (tradesMakerFilter || tradesDeskFilter !== 'all') ? (
          <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border-subtle/25 px-3 py-1 text-[11px]">
            <span className="text-fg-muted">
              {tradesMakerFilter ? (
                <>
                  Showing{' '}
                  <span className="font-medium tabular-nums text-fg-primary">
                    {tradeRowsForTable.length}
                  </span>{' '}
                  transaction{tradeRowsForTable.length === 1 ? '' : 's'} of maker{' '}
                  <span className="font-medium text-fg-secondary">
                    {shortenAddress(tradesMakerFilter, 5)}
                  </span>
                </>
              ) : tradesDeskFilter === 'you' ? (
                <>
                  Showing{' '}
                  <span className="font-medium tabular-nums text-fg-primary">
                    {tradeRowsForTable.length}
                  </span>{' '}
                  of your transaction{tradeRowsForTable.length === 1 ? '' : 's'}
                </>
              ) : tradesDeskFilter === 'dev' ? (
                <>
                  Showing{' '}
                  <span className="font-medium tabular-nums text-fg-primary">
                    {tradeRowsForTable.length}
                  </span>{' '}
                  dev wallet transaction{tradeRowsForTable.length === 1 ? '' : 's'}
                </>
              ) : (
                <>
                  Showing{' '}
                  <span className="font-medium tabular-nums text-fg-primary">
                    {tradeRowsForTable.length}
                  </span>{' '}
                  tracked wallet transaction{tradeRowsForTable.length === 1 ? '' : 's'}
                </>
              )}
            </span>
            <button
              type="button"
              onClick={
                tradesMakerFilter ? handleClearTradesMakerFilter : handleClearTradesDeskFilter
              }
              className="btn-press shrink-0 text-[11px] font-semibold uppercase tracking-wide text-signal-info hover:text-signal-info/80"
            >
              Reset
            </button>
          </div>
        ) : null}
        {tab === 'trades' ? (
          tradeRowsForTable.length === 0 ? (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-[11px] font-sans text-fg-muted">
              <p className="font-medium text-fg-secondary">
                {demoTables
                  ? 'No transactions found'
                  : indexerPending
                    ? 'No indexed chain trades for this token yet'
                    : qaMint
                      ? 'No trades yet'
                      : 'No trades yet'}
              </p>
              {!demoTables && indexerPending ? (
                <p className="max-w-[26rem] text-fg-muted">
                  Pointer indexes the chain tape per token. Trigger an index backfill
                  to populate this view — recent Dex activity will appear as swaps are
                  parsed and stored.
                </p>
              ) : null}
            </div>
          ) : (
            <MintTradesScroll
              rows={tradeRowsForTable}
              mint={mint}
              tokenSymbol={sym}
              creatorWallet={creatorWallet}
              supplyTokens={supplyTokens}
              marketCapUsd={marketCapUsd}
              nativeSym={nativeSym}
              displayMode={displayMode}
              mcDisplay={tradesMcDisplay}
              onHoverChange={setTradesFeedHoverPause}
              onFilterMintTrades={handleFilterMintTrades}
              tradesMakerFilter={tradesMakerFilter}
              onToggleTotalDisplayMode={() => setTableUsd((u) => !u)}
              onToggleMcDisplay={() => setTradesMcDisplay((m) => (m === 'mc' ? 'price' : 'mc'))}
              ageSortDir={tradesAgeSortDir}
              onAgeSortDirChange={onTradesAgeSortDirChange}
              ageDisplay={tradesAgeDisplay}
              onAgeDisplayChange={onTradesAgeDisplayChange}
              viewerWallet={activeWalletAddress}
            />
          )
        ) : null}
        {tab === 'positions' ? <PositionsDesk sym={sym} mint={mint} demoTables={demoTables} /> : null}
        {tab === 'orders' ? <OrdersDesk sym={sym} demoTables={demoTables} /> : null}
        {tab === 'holders' ? (
          <HoldersTable
            mint={mint}
            tokenSymbol={sym}
            creatorWallet={creatorWallet}
            onlyTracked={onlyTracked}
            deskFilter={holderDeskFilter}
            onFilterMintTrades={handleFilterMintTrades}
            tradesMakerFilter={tradesMakerFilter}
            onOpenSettings={() => setHoldersSettingsOpen(true)}
          />
        ) : null}
        {tab === 'traders' ? (
          tradersEmpty ? (
            <div className="p-4">
              <EmptyState
                icon={BarChart3}
                title={
                  tradersLensEmpty
                    ? 'No wallets match filter'
                    : onlyTracked
                      ? 'No tracked traders here'
                      : demoTables
                        ? 'No ranked traders'
                        : indexerPending
                          ? 'Chain trader ranking not indexed yet'
                          : 'No top traders yet'
                }
                description={
                  tradersLensEmpty
                    ? 'Loosen desk filters / pick “All”.'
                    : onlyTracked
                      ? 'Add wallets in Trackers, then filter this table to them.'
                      : demoTables
                        ? 'Demo ranks — not live chain data.'
                        : indexerPending
                          ? 'Ranks below only include trades executed through Pointer until this mint is chain-indexed.'
                          : undefined
                }
              />
            </div>
          ) : (
            <div className={cn('desk-scroll-well', DESK_SCROLL_WELL_CLASS)}>
                {indexerPending && !demoTables ? (
                  <p className="border-b border-border-subtle/40 px-3 py-1.5 text-[10px] leading-snug text-fg-muted">
                    Pointer platform trades only — chain-wide trader ranking is not indexed
                    for this token yet.
                  </p>
                ) : null}
                <TopTradersTable
                  rows={sortedTraders}
                  mint={mint}
                  tokenSymbol={sym}
                  creatorWallet={creatorWallet}
                  displayMode={displayMode}
                  nativeSym={nativeSym}
                  solPriceUsd={nativeUsdHint}
                  onSortPnL={handleSortPnL}
                  sortDir={traderPnlSortDir}
                  onFilterMintTrades={handleFilterMintTrades}
                  tradesMakerFilter={tradesMakerFilter}
                  onOpenSettings={() => setHoldersSettingsOpen(true)}
                />
            </div>
          )
        ) : null}
        {tab === 'dev_tokens' && creatorWallet ? (
          <DevTokensPane creatorWallet={creatorWallet} dev={dev} tokens={devTokensForPane} />
        ) : tab === 'dev_tokens' ? (
          <PlaceholderTab
            title="Dev token list"
            body="No creator wallet found for this token."
          />
        ) : null}

        {/* Holder bubble map — Axiom-style slide-out: overlays the active table on
            the right, drag-resizable from its left edge, on-theme. Not a tab. */}
        {bubblesOpen ? (
          <div
            className="absolute inset-y-0 right-0 z-20 flex max-w-full animate-in slide-in-from-right-4 duration-150 border-l border-border-default bg-bg-base shadow-[0_0_40px_rgba(0,0,0,0.45)]"
            style={{ width: bubbleMapW }}
          >
            <div
              onPointerDown={onBubbleResizeDown}
              onPointerMove={onBubbleResizeMove}
              onPointerUp={onBubbleResizeUp}
              className="group absolute left-0 top-0 z-10 h-full w-2 -translate-x-1/2 cursor-col-resize touch-none"
              role="separator"
              aria-orientation="vertical"
              title="Drag to resize"
            >
              <div className="mx-auto h-full w-px bg-border-subtle transition-colors group-hover:bg-accent-primary" />
            </div>
            <div className="flex min-w-0 flex-1 flex-col">
              <div className="flex shrink-0 items-center justify-between border-b border-border-subtle/40 px-3 py-1.5">
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-fg-primary">
                  <Workflow className="h-3.5 w-3.5 text-accent-primary" strokeWidth={2} aria-hidden />
                  Bubble map
                </span>
                <button
                  type="button"
                  onClick={() => setBubblesOpen(false)}
                  className="btn-press inline-flex h-6 w-6 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
                  aria-label="Close bubble map"
                >
                  <X className="h-3.5 w-3.5" strokeWidth={2} />
                </button>
              </div>
              <BubbleMapPanel mint={mint} symbol={sym} />
            </div>
          </div>
        ) : null}
      </div>
      <HoldersTableSettingsModal
        open={holdersSettingsOpen}
        onClose={() => setHoldersSettingsOpen(false)}
        title={tab === 'traders' ? 'Top Traders Table Settings' : 'Holders Table Settings'}
      />
    </div>
  );
}
