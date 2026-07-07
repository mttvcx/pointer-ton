'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowLeftRight,
  ChefHat,
  Crosshair,
  Fish,
  Target,
} from 'lucide-react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/shared/Skeleton';
import { TradesDeskFilterPill } from '@/components/tokens/cells/TradesDeskFilterPill';
import { useActiveWalletStore } from '@/store/activeWallet';
import { useTrackedWalletsLookup } from '@/lib/hooks/useTrackedWalletsLookup';
import {
  tradeRowMatchesDeskFilter,
  tradeFillMarketCapUsdLabel,
  tradeIsDeskSwap,
  tradeIsLiquidityEvent,
  tradeMakerWallet,
  tradeMcColumnLabel,
  tradeRowDemoIndex,
  tradeTraderHint,
  tradeWalletDeskExtras,
  walletsMatch,
  type TradesDeskFilter,
} from '@/lib/tokens/tradeFormatting';
import { TradeDeskYouLabel } from '@/components/tokens/cells/TradeDeskYouLabel';
import { preferTokenTableDemoRows } from '@/lib/dev/uiDemoMode';
import { isPointerQaMintClient } from '@/lib/qa/pointerQaMintClient';
import { formatRelativeShort } from '@/lib/format';
import { InlineBarCell } from '@/components/tokens/cells/InlineBarCell';
import { SortIndicator } from '@/components/tokens/cells/SortableTh';
import { WalletIdentityAnchor } from '@/components/wallet/identity/WalletIdentityAnchor';
import { useUIStore } from '@/store/ui';
import { ChainIcon } from '@/components/squads/ChainIcon';
import { TerminalUsdPrice } from '@/lib/utils/terminalBalanceFormat';

const TokenChart = dynamic(
  () => import('@/components/tokens/TokenChart').then((m) => ({ default: m.TokenChart })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-[420px] w-full rounded-lg" />,
  },
);
const BuySellPanel = dynamic(
  () => import('@/components/tokens/BuySellPanel').then((m) => ({ default: m.BuySellPanel })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full min-h-[420px] w-full rounded-lg" />,
  },
);
import { TokenActivityTabs } from '@/components/tokens/TokenActivityTabs';
import type { DevWalletStatsRow } from '@/lib/db/wallets';
import type { TokenMarketSnapshotRow } from '@/lib/db/tokens';
import type { Tables } from '@/lib/supabase/types';
import { formatCompactUsd, formatNumber } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';
import { noteRecentTradeMint } from '@/store/recentTradeMints';
import { useTradingStore } from '@/store/trading';
import { useTokenPageLayoutStore } from '@/store/tokenPageLayout';

type LimitOrderRow = Tables<'limit_orders'>;
type MintTradeRow = Tables<'trades'>;

const MIN_LEFT_COL = 380;
const MIN_RIGHT_STACK = 320;
const MAX_RIGHT_STACK = 640;
const H_GRIP = 4;
const MIN_CHART = 200;
const MIN_TABS = 160;

/** Reserve subtracted from 100dvh for sticky trades desk height — aligns with chartSplitAvailPx chrome fudge. */
const TOKEN_DESK_VIEWPORT_RESERVE = 72;

/** Upper bound for chart height — token page scrolls until the sticky desk fills the viewport; chart drag clamps against that “desk ceiling”. */
function chartSplitAvailPx(): number {
  if (typeof window === 'undefined') return MIN_CHART + MIN_TABS + H_GRIP + 400;
  const viewportH = window.innerHeight;
  const bottomBar =
    Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-bottombar-h')) ||
    40;
  const chrome = bottomBar + TOKEN_DESK_VIEWPORT_RESERVE + 80;
  return Math.max(MIN_CHART + MIN_TABS + H_GRIP, viewportH - chrome);
}

function maxChartHeightPx(): number {
  return chartSplitAvailPx() - MIN_TABS;
}

function ColResizeGrip({
  ariaLabel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  ariaLabel: string;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="group relative z-20 hidden w-1 shrink-0 cursor-col-resize bg-transparent lg:block"
    >
      <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-border-subtle group-hover:bg-accent-glow/50" />
    </div>
  );
}

function RowResizeGrip({
  ariaLabel,
  onPointerDown,
  onPointerMove,
  onPointerUp,
}: {
  ariaLabel: string;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerMove: (e: React.PointerEvent<HTMLDivElement>) => void;
  onPointerUp: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      role="separator"
      aria-orientation="horizontal"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className="group relative z-20 hidden h-1 w-full shrink-0 cursor-row-resize bg-transparent lg:block"
    >
      <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-border-subtle group-hover:bg-accent-glow/50" />
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

function tradeMcSnapshot(
  t: MintTradeRow,
  supplyTokens: number | null | undefined,
  fallbackMcUsd: number | null | undefined,
): string {
  return tradeMcColumnLabel(t, supplyTokens, fallbackMcUsd);
}

function optionalTradeBool(row: MintTradeRow, key: string): boolean {
  const r = row as Record<string, unknown>;
  return r[key] === true;
}

function TokenLiveTradesSidePanel({
  rows,
  isLoading,
  mint,
  symbol,
  creatorWallet,
  supplyTokens,
  marketCapUsd,
  tradesDeskFilter,
  onToggleDeskFilter,
  ageSortDir,
  onToggleAgeSort,
}: {
  rows: MintTradeRow[];
  isLoading: boolean;
  mint: string;
  symbol: string | null;
  creatorWallet: string | null;
  supplyTokens: number | null | undefined;
  marketCapUsd: number | null | undefined;
  tradesDeskFilter: TradesDeskFilter;
  onToggleDeskFilter: (id: Exclude<TradesDeskFilter, 'all'>) => void;
  ageSortDir: 'asc' | 'desc';
  onToggleAgeSort: () => void;
}) {
  const { isTracked } = useTrackedWalletsLookup();
  const activeWalletAddress = useActiveWalletStore((s) => s.activeWalletAddress);
  const [displayMode, setDisplayMode] = useState<'USD' | 'SOL'>('SOL');
  const [valueColumn, setValueColumn] = useState<'mc' | 'price'>('mc');

  const tradeRows = useMemo(() => rows.filter(tradeIsDeskSwap), [rows]);

  const filteredRows = useMemo(() => {
    if (tradesDeskFilter === 'all') return tradeRows;
    return tradeRows.filter((row, rowIndex) => {
      const wallet = tradeMakerWallet(row, rowIndex) ?? row.user_id;
      return tradeRowMatchesDeskFilter({
        wallet,
        creatorWallet,
        tracked: wallet ? isTracked(wallet) : false,
        userWallet: activeWalletAddress,
        filter: tradesDeskFilter,
      });
    });
  }, [tradeRows, tradesDeskFilter, creatorWallet, isTracked, activeWalletAddress]);

  const sortedRows = useMemo(() => {
    return [...filteredRows].sort((a, b) => {
      const ta = new Date(a.submitted_at).getTime();
      const tb = new Date(b.submitted_at).getTime();
      if (!Number.isFinite(ta) || !Number.isFinite(tb)) return 0;
      return ageSortDir === 'asc' ? ta - tb : tb - ta;
    });
  }, [filteredRows, ageSortDir]);

  const { maxSol, maxUsd } = useMemo(() => {
    let s = 0;
    let u = 0;
    for (const r of sortedRows) {
      const sol = Math.abs(r.amount_sol ?? 0);
      const usd = sol * Math.abs(r.price_usd_at_fill ?? 0);
      if (sol > s) s = sol;
      if (usd > u) u = usd;
    }
    return { maxSol: s || 1, maxUsd: u || 1 };
  }, [sortedRows]);

  const qaLive = isPointerQaMintClient(mint);

  return (
    <div className="flex min-w-[220px] max-w-[280px] shrink-0 flex-1 flex-col overflow-hidden border-l border-border-subtle bg-bg-raised lg:max-w-none lg:flex-none lg:basis-[240px]">
      <div className="flex items-center gap-0.5 border-b border-border-subtle/25 px-2 py-0.5">
        <TradesDeskFilterPill
          id="dev"
          label="Dev"
          active={tradesDeskFilter === 'dev'}
          onClick={() => onToggleDeskFilter('dev')}
        />
        <TradesDeskFilterPill
          id="tracked"
          label="Tracked"
          active={tradesDeskFilter === 'tracked'}
          onClick={() => onToggleDeskFilter('tracked')}
        />
        <TradesDeskFilterPill
          id="you"
          label="You"
          active={tradesDeskFilter === 'you'}
          onClick={() => onToggleDeskFilter('you')}
        />
      </div>
      <div className="flex items-center border-b border-border-subtle/25 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-fg-muted">
        <span className="flex w-[72px] shrink-0 items-center gap-0.5 normal-case tracking-normal">
          <span>Amount</span>
          <button
            type="button"
            onClick={() => setDisplayMode((m) => (m === 'USD' ? 'SOL' : 'USD'))}
            className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-full bg-signal-bull/15 text-signal-bull transition hover:bg-signal-bull/25"
            title="Toggle USD / SOL"
            aria-label="Toggle USD / SOL amount"
          >
            <ArrowLeftRight className="h-2 w-2" strokeWidth={2.5} aria-hidden />
          </button>
        </span>
        <span className="flex w-[58px] shrink-0 items-center gap-0.5 normal-case tracking-normal">
          <span>{valueColumn === 'mc' ? 'MC' : 'Price'}</span>
          <button
            type="button"
            onClick={() => setValueColumn((c) => (c === 'mc' ? 'price' : 'mc'))}
            className="inline-flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded text-fg-muted/60 transition hover:bg-white/[0.06] hover:text-fg-primary"
            title="Toggle MC / Price"
            aria-label="Toggle MC / Price"
          >
            <ArrowLeftRight className="h-2 w-2" strokeWidth={2.5} aria-hidden />
          </button>
        </span>
        <span className="min-w-0 flex-1">Trader</span>
        <button
          type="button"
          onClick={onToggleAgeSort}
          className="ml-auto flex shrink-0 items-center gap-0.5 normal-case tracking-normal text-fg-primary transition-colors hover:text-fg-primary"
          aria-label={`Sort trades by age, ${ageSortDir === 'desc' ? 'newest first' : 'oldest first'}`}
          title={`Sort ${ageSortDir === 'desc' ? 'newest first' : 'oldest first'}`}
        >
          Age
          <SortIndicator sortDir={ageSortDir} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-bg-hover/40" />
            ))}
          </div>
        ) : sortedRows.length === 0 ? (
          <p className="px-3 py-4 text-center text-[11px] text-fg-muted">
            {qaLive || !preferTokenTableDemoRows() ? 'No trades yet' : 'No transactions found'}
          </p>
        ) : (
          sortedRows.map((t, i) => {
            const sol = t.amount_sol ?? 0;
            const usdValue = Math.abs(sol * (t.price_usd_at_fill ?? 0));
            const solStr =
              sol != null && Number.isFinite(sol)
                ? formatNumber(sol, { decimals: Math.abs(sol) < 1 ? 3 : 2 })
                : '\u2014';
            const liqEvent = tradeIsLiquidityEvent(t);
            const tone = liqEvent ? 'sell' : t.side === 'buy' ? 'buy' : 'sell';
            const barValue = displayMode === 'SOL' ? Math.abs(sol) : usdValue;
            const barMax = displayMode === 'SOL' ? maxSol : maxUsd;
            const traderHint = tradeTraderHint(t, i);
            const wallet = traderHint.fullAddress;
            const demoIdx = tradeRowDemoIndex(t);
            const chainBadges = (t as MintTradeRow & { desk_badges?: string[] }).desk_badges;
            const deskExtras = wallet
              ? tradeWalletDeskExtras(wallet, demoIdx, creatorWallet, chainBadges as never)
              : null;
            const mc = tradeMcSnapshot(t, supplyTokens, marketCapUsd);
            const ageLabel = formatRelativeShort(t.submitted_at);

            return (
              <div
                key={t.id}
                className={cn(
                  'flex items-center border-b border-border-subtle/25 px-2 py-0.5 text-xs transition-colors last:border-b-0',
                  liqEvent ? 'bg-signal-bear/[0.06] hover:bg-signal-bear/10' : 'hover:bg-white/[0.03]',
                )}
              >
                <div className="relative mr-1 h-6 w-[72px] shrink-0 overflow-hidden rounded-sm">
                  <InlineBarCell value={barValue} max={barMax} tone={tone} className="h-full min-h-6">
                    {displayMode === 'SOL' ? (
                      <>
                        <ChainIcon chain="sol" size={11} />
                        {solStr}
                      </>
                    ) : (
                      formatCompactUsd(usdValue)
                    )}
                  </InlineBarCell>
                </div>
                <span
                  className={cn(
                    'w-[58px] shrink-0 truncate font-sans tabular-nums',
                    liqEvent && valueColumn === 'mc'
                      ? 'font-semibold uppercase text-fg-primary'
                      : 'text-fg-secondary',
                  )}
                  title={valueColumn === 'mc' ? mc : undefined}
                >
                  {valueColumn === 'mc' ? (
                    mc
                  ) : (
                    <TerminalUsdPrice price={t.price_usd_at_fill} className="text-[11px]" />
                  )}
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-0.5">
                  {wallet && deskExtras ? (
                    walletsMatch(wallet, activeWalletAddress) ? (
                      <TradeDeskYouLabel />
                    ) : (
                    <WalletIdentityAnchor
                      address={wallet}
                      mint={mint}
                      tokenSymbol={symbol}
                      creatorWallet={creatorWallet}
                      href={`/wallet/${encodeURIComponent(wallet)}`}
                      preferIntelModal
                      addressFormat="axiom"
                      truncate={4}
                      outlineOnHover
                      badgeBeforeAddress
                      suppressFilterButton
                      addressNoTruncate
                      maxBadges={2}
                      isDev={deskExtras.isDev}
                      isSniper={deskExtras.isSniper}
                      inlineBadges={deskExtras.inlineBadges}
                      showInlineBadges
                      className="cursor-pointer font-mono text-[11px] text-fg-secondary hover:text-fg-primary"
                    />
                    )
                  ) : (
                    <>
                      <span className="truncate font-mono text-[11px] text-fg-secondary" title={t.user_id}>
                        {traderHint.shortLabel}
                      </span>
                      {optionalTradeBool(t, 'isDev') ? (
                        <span title="Dev wallet">
                          <ChefHat className="h-3 w-3 shrink-0 text-signal-warn" aria-hidden />
                        </span>
                      ) : null}
                      {optionalTradeBool(t, 'isSniper') ? (
                        <span title="Sniper">
                          <Crosshair className="h-3 w-3 shrink-0 text-signal-bear" aria-hidden />
                        </span>
                      ) : null}
                      {optionalTradeBool(t, 'isWhale') ? (
                        <span title="Whale">
                          <Fish className="h-3 w-3 shrink-0 text-signal-info" aria-hidden />
                        </span>
                      ) : null}
                      {optionalTradeBool(t, 'isTracked') ? (
                        <span title="Tracked">
                          <Target className="h-3 w-3 shrink-0 text-accent-primary" aria-hidden />
                        </span>
                      ) : null}
                      {optionalTradeBool(t, 'isInsider') ? (
                        <span title="Insider">
                          <AlertCircle className="h-3 w-3 shrink-0 text-signal-bear" aria-hidden />
                        </span>
                      ) : null}
                    </>
                  )}
                </div>
                <span className="ml-auto shrink-0 pl-1 text-right font-sans tabular-nums text-[10px] text-fg-muted">
                  {ageLabel}
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export function TokenDetailView({
  mint,
  symbol,
  tokenName,
  decimals,
  creatorWallet,
  dev,
  marketSnapshot,
  supplyTokens,
}: {
  mint: string;
  symbol: string | null;
  tokenName?: string | null;
  decimals: number;
  creatorWallet: string | null;
  dev: DevWalletStatsRow | null;
  marketSnapshot?: TokenMarketSnapshotRow | null;
  supplyTokens?: number | null;
}) {
  const searchParams = useSearchParams();
  const alertId = searchParams.get('limitAlert');
  const buySolRaw = searchParams.get('buySol');
  const tradeTabRaw = searchParams.get('tradeTab');
  const initialBuySol = useMemo(() => {
    if (!buySolRaw) return null;
    const n = Number(buySolRaw);
    return Number.isFinite(n) && n > 0 ? n : null;
  }, [buySolRaw]);
  const initialTradeSide = tradeTabRaw === 'sell' ? ('sell' as const) : ('buy' as const);

  useEffect(() => {
    noteRecentTradeMint(mint);
  }, [mint]);
  const { getAccessToken, authenticated } = usePointerAuth();
  const activeChain = useUIStore((s) => s.activeChain);

  const rightStackW = useTokenPageLayoutStore((s) => s.rightStackW);
  const setRightStackW = useTokenPageLayoutStore((s) => s.setRightStackW);
  const chartH = useTokenPageLayoutStore((s) => s.chartH);
  const setChartH = useTokenPageLayoutStore((s) => s.setChartH);
  const [lg, setLg] = useState(false);
  const instantTradeOpen = useTradingStore((s) => s.compactInstantTradeOpen);
  const toggleCompactInstantTrade = useTradingStore((s) => s.toggleCompactInstantTrade);
  const tradesPanel = useTokenPageLayoutStore((s) => s.tradesPanel);
  const setTradesPanel = useTokenPageLayoutStore((s) => s.setTradesPanel);
  const tradesDeskFilter = useTokenPageLayoutStore((s) => s.tradesDeskFilter);
  const setTradesDeskFilter = useTokenPageLayoutStore((s) => s.setTradesDeskFilter);
  const tradesAgeSortDir = useTokenPageLayoutStore((s) => s.tradesAgeSortDir);
  const setTradesAgeSortDir = useTokenPageLayoutStore((s) => s.setTradesAgeSortDir);
  const tradesAgeDisplay = useTokenPageLayoutStore((s) => s.tradesAgeDisplay);
  const setTradesAgeDisplay = useTokenPageLayoutStore((s) => s.setTradesAgeDisplay);
  const [liveTrades, setLiveTrades] = useState<{ rows: MintTradeRow[]; isLoading: boolean }>({
    rows: [],
    isLoading: true,
  });
  const toggleTradesDeskFilter = useCallback(
    (id: Exclude<TradesDeskFilter, 'all'>) => {
      const cur = useTokenPageLayoutStore.getState().tradesDeskFilter;
      setTradesDeskFilter(cur === id ? 'all' : id);
    },
    [setTradesDeskFilter],
  );

  const toggleTradesAgeSort = useCallback(() => {
    const d = useTokenPageLayoutStore.getState().tradesAgeSortDir;
    setTradesAgeSortDir(d === 'desc' ? 'asc' : 'desc');
  }, [setTradesAgeSortDir]);

  const onLiveTradesSnapshot = useCallback(
    (s: { rows: MintTradeRow[]; isLoading: boolean }) => {
      setLiveTrades(s);
    },
    [],
  );

  const containerRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);

  const dragCol = useRef(false);
  const startCol = useRef({ x: 0, right: 340 });

  const dragRow = useRef(false);
  const startRow = useRef({ y: 0, chartH: 300 });

  const focusedOrderQ = useQuery({
    queryKey: ['limit-order-single', alertId],
    queryFn: async (): Promise<LimitOrderRow | null> => {
      if (!alertId) return null;
      const token = await getAccessToken();
      if (!token) return null;
      const r = await fetch(`/api/limit-orders/${encodeURIComponent(alertId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.status === 404) return null;
      if (!r.ok) throw new Error('limit_order_fetch');
      const json = (await r.json()) as { order: LimitOrderRow };
      return json.order;
    },
    enabled: Boolean(authenticated && alertId),
  });

  const deepLinkOrder = focusedOrderQ.data;
  const limitAlertForPanel = useMemo(() => {
    if (!deepLinkOrder || deepLinkOrder.mint !== mint) return null;
    if (deepLinkOrder.status !== 'triggered') return null;
    return deepLinkOrder;
  }, [deepLinkOrder, mint]);

  useEffect(() => {
    document.documentElement.style.setProperty('--token-trade-rail-w', `${rightStackW}px`);
    return () => {
      document.documentElement.style.removeProperty('--token-trade-rail-w');
    };
  }, [rightStackW]);

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setLg(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const sync = () => {
      const avail = chartSplitAvailPx();
      const ch = useTokenPageLayoutStore.getState().chartH;
      if (ch == null) {
        setChartH(Math.round(Math.min(480, (avail * 58) / 100)));
        return;
      }
      setChartH(clamp(ch, MIN_CHART, maxChartHeightPx()));
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, [setChartH]);

  const maxRightForContainer = useCallback((containerW: number) => {
    return Math.min(MAX_RIGHT_STACK, Math.max(MIN_RIGHT_STACK, containerW - MIN_LEFT_COL - 6));
  }, []);

  const onColDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      dragCol.current = true;
      startCol.current = { x: e.clientX, right: rightStackW };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [rightStackW],
  );

  const onColMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!dragCol.current || !containerRef.current) return;
      const C = containerRef.current.clientWidth;
      const delta = e.clientX - startCol.current.x;
      const maxR = maxRightForContainer(C);
      const next = clamp(startCol.current.right + delta, MIN_RIGHT_STACK, maxR);
      setRightStackW(next);
    },
    [maxRightForContainer],
  );

  const onColUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragCol.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
  }, []);

  const onRowDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const parent = leftColRef.current;
      if (!parent) return;
      const chartEl = parent.children[0] as HTMLElement | undefined;
      const H = parent.clientHeight;
      const parentAvail = H - H_GRIP;
      const maxChart = Math.min(maxChartHeightPx(), parentAvail - MIN_TABS);
      if (maxChart < MIN_CHART) return;
      const measured =
        chartH ??
        (chartEl ? Math.round(chartEl.getBoundingClientRect().height) : Math.round((parentAvail * 62) / 100));
      const baseline = clamp(measured, MIN_CHART, maxChart);
      dragRow.current = true;
      startRow.current = { y: e.clientY, chartH: baseline };
      if (chartH == null) setChartH(baseline);
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [chartH],
  );

  const onRowMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragRow.current || !leftColRef.current) return;
    const H = leftColRef.current.clientHeight;
    const parentAvail = H - H_GRIP;
    const maxChart = Math.min(maxChartHeightPx(), parentAvail - MIN_TABS);
    const delta = e.clientY - startRow.current.y;
    const next = Math.round(clamp(startRow.current.chartH + delta, MIN_CHART, maxChart));
    setChartH(next);
  }, []);

  const onRowUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    dragRow.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
  }, []);

  return (
    <>
      <div className="flex w-full min-w-0 flex-col lg:flex-row lg:items-stretch">
        <div
          ref={containerRef}
          className="flex min-w-0 flex-1 flex-col border-b border-border-subtle lg:flex-row lg:items-stretch"
        >
          <div
            ref={leftColRef}
            className={cn(
              'flex min-w-0 flex-1 flex-col bg-bg-raised lg:overflow-visible',
              lg && 'min-w-[360px]',
            )}
          >
            <div
              className={cn(
                'flex w-full min-w-0 flex-row',
                chartH != null ? 'shrink-0' : 'min-h-[200px] shrink-0',
              )}
              style={
                chartH != null
                  ? { height: chartH, minHeight: MIN_CHART, flex: '0 0 auto' }
                  : { minHeight: MIN_CHART }
              }
            >
              <div className="flex min-h-0 min-w-0 flex-1 flex-col px-0.5 pt-0.5">
                <TokenChart mint={mint} symbol={symbol} supplyTokens={supplyTokens ?? null} edgeToEdge />
              </div>
              {tradesPanel ? (
                <TokenLiveTradesSidePanel
                  rows={liveTrades.rows}
                  isLoading={liveTrades.isLoading}
                  mint={mint}
                  symbol={symbol}
                  creatorWallet={creatorWallet}
                  supplyTokens={supplyTokens}
                  marketCapUsd={marketSnapshot?.market_cap_usd}
                  tradesDeskFilter={tradesDeskFilter}
                  onToggleDeskFilter={toggleTradesDeskFilter}
                  ageSortDir={tradesAgeSortDir}
                  onToggleAgeSort={toggleTradesAgeSort}
                />
              ) : null}
            </div>

            <RowResizeGrip
              ariaLabel="Resize chart versus tables"
              onPointerDown={onRowDown}
              onPointerMove={onRowMove}
              onPointerUp={onRowUp}
            />

            {/* Sticky desk: outer page scroll stops once this fills the viewport; lists scroll inside */}
            <div className="sticky top-0 z-[8] flex h-[calc(100dvh-var(--app-bottombar-h)-72px)] min-h-[260px] max-h-[calc(100dvh-var(--app-bottombar-h)-72px)] shrink-0 flex-col overflow-hidden overscroll-y-auto border-t border-border-subtle/25 bg-bg-raised">
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <TokenActivityTabs
                  mint={mint}
                  symbol={symbol}
                  creatorWallet={creatorWallet}
                  dev={dev}
                  supplyTokens={supplyTokens}
                  marketCapUsd={marketSnapshot?.market_cap_usd}
                  tradesPanel={tradesPanel}
                  onTradesPanelChange={setTradesPanel}
                  tradesDeskFilter={tradesDeskFilter}
                  onTradesDeskFilterChange={setTradesDeskFilter}
                  tradesAgeSortDir={tradesAgeSortDir}
                  onTradesAgeSortDirChange={setTradesAgeSortDir}
                  tradesAgeDisplay={tradesAgeDisplay}
                  onTradesAgeDisplayChange={setTradesAgeDisplay}
                  onLiveTradesSnapshot={onLiveTradesSnapshot}
                  onOpenInstantTrade={toggleCompactInstantTrade}
                  instantTradeOpen={instantTradeOpen}
                />
              </div>
            </div>
          </div>

          <ColResizeGrip
            ariaLabel="Resize chart versus trade stack"
            onPointerDown={onColDown}
            onPointerMove={onColMove}
            onPointerUp={onColUp}
          />

          <div
            className={cn(
              'flex w-full max-w-full min-w-0 shrink-0 flex-col border-t border-border-subtle bg-bg-raised lg:sticky lg:top-0 lg:min-h-0 lg:max-h-[calc(100dvh-var(--app-bottombar-h)-72px)] lg:self-stretch lg:overflow-hidden lg:border-l lg:border-t-0',
            )}
            style={lg ? { width: rightStackW } : undefined}
          >
            <div className="flex min-h-0 min-w-0 flex-1 flex-col lg:overflow-y-auto lg:overscroll-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              <BuySellPanel
                key={
                  mint +
                  (limitAlertForPanel?.id ?? '') +
                  String(initialBuySol ?? '') +
                  initialTradeSide
                }
                mint={mint}
                symbol={symbol}
                tokenName={tokenName}
                decimals={decimals}
                limitAlertOrder={limitAlertForPanel}
                initialBuySol={initialBuySol}
                initialTradeSide={initialTradeSide}
                marketSnapshot={marketSnapshot ?? null}
                onRequestInstantTrade={toggleCompactInstantTrade}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
