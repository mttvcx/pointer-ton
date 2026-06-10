'use client';

import { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Activity, BarChart3, ChevronUp, LayoutPanelTop, Settings, Table2, Zap } from 'lucide-react';
import type { AppChainId } from '@/lib/chains/appChain';
import { nativeTicker } from '@/lib/chains/nativeCurrency';
import { formatCompactUsd } from '@/lib/format';
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
  DESK_ROW_CLASS,
  DESK_SCROLL_WELL_CLASS,
  DESK_STICKY_HEAD_CLASS,
  DESK_TABLE_CLASS,
} from '@/components/tokens/cells/deskTokens';
import { useActiveWalletStore } from '@/store/activeWallet';

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
  onHoverChange,
  onFilterMintTrades,
  tradesMakerFilter,
  onToggleDisplayMode,
  ageSortDir,
  onAgeSortDirChange,
  ageDisplay,
  onAgeDisplayChange,
}: {
  rows: TradeRow[];
  mint: string;
  tokenSymbol: string;
  creatorWallet: string | null;
  supplyTokens?: number | null;
  marketCapUsd?: number | null;
  nativeSym: string;
  displayMode: 'USD' | 'SOL';
  onHoverChange: (paused: boolean) => void;
  onFilterMintTrades?: (address: string) => void;
  tradesMakerFilter?: string | null;
  onToggleDisplayMode?: () => void;
  ageSortDir: 'asc' | 'desc';
  onAgeSortDirChange: (dir: 'asc' | 'desc') => void;
  ageDisplay: 'age' | 'time';
  onAgeDisplayChange: (mode: 'age' | 'time') => void;
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
    <div className="relative flex min-h-0 flex-1 flex-col">
      <div
        ref={scrollRef}
        className={cn('desk-scroll-well', DESK_SCROLL_WELL_CLASS)}
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
          displayMode={displayMode}
          nativeSym={nativeSym}
          onFilterMintTrades={onFilterMintTrades}
          tradesMakerFilter={tradesMakerFilter}
          onToggleDisplayMode={onToggleDisplayMode}
          ageSortDir={ageSortDir}
          onAgeSortDirChange={onAgeSortDirChange}
          ageDisplay={ageDisplay}
          onAgeDisplayChange={onAgeDisplayChange}
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
              <tr key={i} className={DESK_ROW_CLASS}>
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
              <tr key={i} className={DESK_ROW_CLASS}>
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
  const [tradesFeedHoverPause, setTradesFeedHoverPause] = useState(false);
  const [onlyTracked, setOnlyTracked] = useState(false);
  const [traderDeskFilter, setTraderDeskFilter] = useState<TraderDeskFilter>('all');
  const [holderDeskFilter, setHolderDeskFilter] = useState<TraderDeskFilter>('all');
  const [tableUsd, setTableUsd] = useState(true);
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
    queryKey: ['mint-top-traders', mint, isPointerQaMintClient(mint) ? 'chain' : 'pointer'],
    queryFn: async () => {
      const path = isPointerQaMintClient(mint)
        ? `/api/tokens/${encodeURIComponent(mint)}/chain-top-traders?limit=25`
        : `/api/tokens/${encodeURIComponent(mint)}/top-traders?limit=25`;
      const r = await fetch(path);
      if (!r.ok) throw new Error('traders');
      return r.json() as Promise<{ traders: MintTopTraderRow[]; source?: string }>;
    },
    enabled: tab === 'traders',
    placeholderData: demoTables ? { traders: demoTraders } : undefined,
    staleTime: 30_000,
  });

  const holdersQ = useQuery({
    queryKey: ['token-holders', mint],
    queryFn: async () => {
      const r = await fetch(`/api/tokens/${encodeURIComponent(mint)}/holders`);
      if (!r.ok) throw new Error('holders_failed');
      return r.json() as Promise<{ holders: { id: number }[] }>;
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
    return traderDeskFilter === 'all'
      ? traderRowsAfterTrack
      : traderRowsAfterTrack.filter((w) =>
          traderRowMatchesFilter({
            row: w,
            creatorWallet,
            tracked: isTracked(w.wallet_address),
            labelDisp: resolveLabel(w.wallet_address, 5),
            filter: traderDeskFilter,
          }),
        );
  }, [
    traderRowsAfterTrack,
    traderDeskFilter,
    creatorWallet,
    resolveLabel,
    isTracked,
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
      return devTokensLiveQ.data.tokens.map((t) => ({
        mint: t.mint,
        symbol: t.symbol ?? '—',
        name: t.name ?? t.symbol ?? 'Token',
        mcUsd: Number(t.market_cap_usd) || 0,
        athUsd: Number(t.market_cap_usd) || 0,
        liquidityUsd: 0,
        volume1hUsd: Number(t.volume_24h_usd) || 0,
        balanceUsd: 0,
        pnlUsd: 0,
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
      const n = holdersQ.data?.holders?.length;
      if (n != null && n > 0) return `Holders (${n})`;
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
    <div className="flex min-h-0 flex-1 flex-col bg-bg-raised font-sans text-[12px] leading-snug text-fg-primary antialiased">
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
          {showTableControls ? (
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
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden w-full">
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
            <div className="flex flex-1 flex-col items-center justify-center gap-1 p-8 text-center text-[11px] font-sans text-fg-muted">
              <p className="font-medium text-fg-secondary">
                {demoTables ? 'No transactions found' : 'No trades yet'}
              </p>
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
              onHoverChange={setTradesFeedHoverPause}
              onFilterMintTrades={handleFilterMintTrades}
              tradesMakerFilter={tradesMakerFilter}
              onToggleDisplayMode={() => setTableUsd((u) => !u)}
              ageSortDir={tradesAgeSortDir}
              onAgeSortDirChange={onTradesAgeSortDirChange}
              ageDisplay={tradesAgeDisplay}
              onAgeDisplayChange={onTradesAgeDisplayChange}
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
                        : 'No top traders yet'
                }
                description={
                  tradersLensEmpty
                    ? 'Loosen desk filters / pick “All”.'
                    : onlyTracked
                      ? 'Add wallets in Trackers, then filter this table to them.'
                      : demoTables
                        ? 'Demo ranks — not live chain data.'
                        : undefined
                }
              />
            </div>
          ) : (
            <div className={cn('desk-scroll-well', DESK_SCROLL_WELL_CLASS)}>
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
      </div>
      <HoldersTableSettingsModal
        open={holdersSettingsOpen}
        onClose={() => setHoldersSettingsOpen(false)}
        title={tab === 'traders' ? 'Top Traders Table Settings' : 'Holders Table Settings'}
      />
    </div>
  );
}
