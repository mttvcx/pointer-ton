'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  AlertCircle,
  ArrowUpDown,
  ChefHat,
  Crosshair,
  Filter,
  Fish,
  Target,
  User,
} from 'lucide-react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useQuery } from '@tanstack/react-query';
import { TokenChart } from '@/components/tokens/TokenChart';
import { TokenActivityTabs } from '@/components/tokens/TokenActivityTabs';
import { BuySellPanel } from '@/components/tokens/BuySellPanel';
import { CompactInstantTradePanel } from '@/components/trading/CompactInstantTradePanel';
import { UiDemoModeBanner } from '@/components/tokens/UiDemoModeBanner';
import { TokenPageDockFooter } from '@/components/tokens/TokenPageDockFooter';
import type { DevWalletStatsRow } from '@/lib/db/wallets';
import type { TokenMarketSnapshotRow } from '@/lib/db/tokens';
import type { Tables } from '@/lib/supabase/types';
import { shortenAddress } from '@/lib/utils/addresses';
import { formatAgeShort, formatCompactUsd, formatNumber } from '@/lib/utils/formatters';
import {
  persistChartOverlays,
  readChartOverlays,
  type ChartOverlayFlags,
} from '@/lib/chart/tokenChartOverlays';
import { cn } from '@/lib/utils/cn';
import { noteRecentTradeMint } from '@/store/recentTradeMints';

type LimitOrderRow = Tables<'limit_orders'>;
type MintTradeRow = Tables<'trades'>;

const MIN_LEFT_COL = 380;
const MIN_RIGHT_STACK = 280;
const MAX_RIGHT_STACK = 520;
const H_GRIP = 4;
const MIN_CHART = 200;
const MIN_TABS = 120;

/** Upper bound for chart height from viewport chrome (main scroll is one column; row drag should not explode when the left column is very tall). */
function chartSplitAvailPx(): number {
  if (typeof window === 'undefined') return MIN_CHART + MIN_TABS + H_GRIP + 400;
  const viewportH = window.innerHeight;
  const topBar =
    Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-topbar-h')) ||
    48;
  const bottomBar =
    Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--app-bottombar-h')) ||
    40;
  const chrome = topBar + bottomBar + 140;
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

function tradeMcSnapshot(t: MintTradeRow): string {
  const px = t.price_usd_at_fill;
  const amt = t.amount_token;
  if (px == null || amt == null || !Number.isFinite(px) || !Number.isFinite(amt)) return '\u2014';
  const v = px * amt;
  if (!Number.isFinite(v) || v === 0) return '\u2014';
  return formatCompactUsd(v);
}

function optionalTradeBool(row: MintTradeRow, key: string): boolean {
  const r = row as Record<string, unknown>;
  return r[key] === true;
}

function TokenLiveTradesSidePanel({
  rows,
  isLoading,
}: {
  rows: MintTradeRow[];
  isLoading: boolean;
}) {
  const [overlays, setOverlays] = useState<ChartOverlayFlags>(() => readChartOverlays());

  useEffect(() => {
    const sync = () => setOverlays(readChartOverlays());
    window.addEventListener('pointer-chart-overlays', sync);
    return () => window.removeEventListener('pointer-chart-overlays', sync);
  }, []);

  const patchOverlays = useCallback((patch: Partial<ChartOverlayFlags>) => {
    setOverlays((prev) => {
      const next = { ...prev, ...patch };
      persistChartOverlays(next);
      return next;
    });
  }, []);

  return (
    <div className="flex min-w-[220px] max-w-[280px] shrink-0 flex-1 flex-col overflow-hidden border-l border-border-subtle bg-bg-raised lg:max-w-none lg:flex-none lg:basis-[240px]">
      <div className="flex items-center gap-1 border-b border-border-subtle px-3 py-2">
        <button
          type="button"
          className="filter-pill shrink-0"
          data-active={overlays.devTrades ? true : undefined}
          onClick={() => patchOverlays({ devTrades: !overlays.devTrades })}
        >
          <Filter className="h-3 w-3 shrink-0" aria-hidden />
          <span>Dev</span>
        </button>
        <button
          type="button"
          className="filter-pill shrink-0"
          data-active={overlays.trackedOnly ? true : undefined}
          onClick={() => patchOverlays({ trackedOnly: !overlays.trackedOnly })}
        >
          <Filter className="h-3 w-3 shrink-0" aria-hidden />
          <span>Tracked</span>
        </button>
        <button
          type="button"
          className="filter-pill shrink-0"
          data-active={overlays.alertBubbles ? true : undefined}
          onClick={() => patchOverlays({ alertBubbles: !overlays.alertBubbles })}
        >
          <User className="h-3 w-3 shrink-0" aria-hidden />
          <span>You</span>
        </button>
        <button
          type="button"
          className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
          aria-label="Sort trades"
        >
          <ArrowUpDown className="h-3 w-3" aria-hidden />
        </button>
      </div>
      <div className="flex items-center border-b border-border-subtle bg-bg-sunken px-3 py-1.5 text-[10px] font-medium uppercase tracking-wider text-fg-muted">
        <span className="w-[68px] shrink-0">Amount</span>
        <span className="w-[58px] shrink-0">MC</span>
        <span className="min-w-0 flex-1">Trader</span>
        <span className="shrink-0">Age</span>
      </div>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="space-y-2 p-2">
            {Array.from({ length: 10 }).map((_, i) => (
              <div key={i} className="h-6 animate-pulse rounded bg-bg-sunken/80" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="px-3 py-4 text-center text-[11px] text-fg-muted">No trades indexed yet.</p>
        ) : (
          rows.map((t) => {
            const sol = t.amount_sol;
            const solStr = sol != null ? formatNumber(sol, { decimals: 4 }) : '\u2014';
            const bull = t.side === 'buy';
            const traderShort = shortenAddress(t.user_id, 4);
            const mc = tradeMcSnapshot(t);
            const isDev = optionalTradeBool(t, 'isDev');
            const isSniper = optionalTradeBool(t, 'isSniper');
            const isWhale = optionalTradeBool(t, 'isWhale');
            const isTracked = optionalTradeBool(t, 'isTracked');
            const isInsider = optionalTradeBool(t, 'isInsider');

            return (
              <div
                key={t.id}
                className="flex items-center border-b border-border-subtle/30 px-3 py-1 text-xs transition-colors last:border-b-0 hover:bg-bg-hover"
              >
                <span
                  className={cn(
                    'w-[68px] shrink-0 font-mono tabular-nums',
                    bull ? 'text-signal-bull' : 'text-signal-bear',
                  )}
                >
                  ≡ {solStr}
                </span>
                <span className="w-[58px] shrink-0 font-mono tabular-nums text-fg-secondary">{mc}</span>
                <div className="flex min-w-0 flex-1 items-center gap-1">
                  <span className="truncate font-mono text-fg-secondary" title={t.user_id}>
                    {traderShort}
                  </span>
                  {isDev ? (
                    <span title="Dev wallet">
                      <ChefHat className="h-3 w-3 shrink-0 text-signal-warn" aria-hidden />
                    </span>
                  ) : null}
                  {isSniper ? (
                    <span title="Sniper">
                      <Crosshair className="h-3 w-3 shrink-0 text-signal-bear" aria-hidden />
                    </span>
                  ) : null}
                  {isWhale ? (
                    <span title="Whale">
                      <Fish className="h-3 w-3 shrink-0 text-signal-info" aria-hidden />
                    </span>
                  ) : null}
                  {isTracked ? (
                    <span title="Tracked">
                      <Target className="h-3 w-3 shrink-0 text-accent-primary" aria-hidden />
                    </span>
                  ) : null}
                  {isInsider ? (
                    <span title="Insider">
                      <AlertCircle className="h-3 w-3 shrink-0 text-signal-bear" aria-hidden />
                    </span>
                  ) : null}
                </div>
                <span className="ml-2 shrink-0 text-[10px] text-fg-muted">{formatAgeShort(t.submitted_at)}</span>
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

  const [rightStackW, setRightStackW] = useState(340);
  const [chartH, setChartH] = useState<number | null>(null);
  const [lg, setLg] = useState(false);
  const [instantTradeOpen, setInstantTradeOpen] = useState(false);
  const [tradesPanel, setTradesPanel] = useState(true);
  const [liveTrades, setLiveTrades] = useState<{ rows: MintTradeRow[]; isLoading: boolean }>({
    rows: [],
    isLoading: true,
  });

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
    const mq = window.matchMedia('(min-width: 1024px)');
    const sync = () => setLg(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    const sync = () => {
      const avail = chartSplitAvailPx();
      setChartH((ch) => {
        if (ch == null) return Math.round(Math.min(480, (avail * 58) / 100));
        return clamp(ch, MIN_CHART, maxChartHeightPx());
      });
    };
    sync();
    window.addEventListener('resize', sync);
    return () => window.removeEventListener('resize', sync);
  }, []);

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
      <UiDemoModeBanner />
      <div className="flex min-h-0 flex-1 flex-col">
        <div
          ref={containerRef}
          className="flex w-full min-w-0 flex-1 flex-col border-b border-border-subtle lg:flex-row"
        >
          <div
            ref={leftColRef}
            className={cn(
              'flex min-w-0 flex-col bg-bg-base lg:min-h-0',
              lg && 'min-w-[360px] flex-1',
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
                <TokenLiveTradesSidePanel rows={liveTrades.rows} isLoading={liveTrades.isLoading} />
              ) : null}
            </div>

            <RowResizeGrip
              ariaLabel="Resize chart versus tables"
              onPointerDown={onRowDown}
              onPointerMove={onRowMove}
              onPointerUp={onRowUp}
            />

            <div className="flex min-w-0 flex-col bg-bg-base">
              <TokenActivityTabs
                mint={mint}
                symbol={symbol}
                creatorWallet={creatorWallet}
                dev={dev}
                tradesPanel={tradesPanel}
                onTradesPanelChange={setTradesPanel}
                onLiveTradesSnapshot={setLiveTrades}
                onOpenInstantTrade={() => setInstantTradeOpen(true)}
              />
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
              'flex w-full min-w-0 shrink-0 flex-col border-t border-border-subtle bg-bg-base lg:min-h-0 lg:border-l lg:border-t-0',
            )}
            style={lg ? { width: rightStackW } : undefined}
          >
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
              onRequestInstantTrade={() => setInstantTradeOpen(true)}
            />
          </div>
        </div>
        <TokenPageDockFooter mint={mint} symbol={symbol} />
      </div>

      <CompactInstantTradePanel
        mint={mint}
        symbol={symbol}
        decimals={decimals}
        open={instantTradeOpen}
        onClose={() => setInstantTradeOpen(false)}
        onOpenFullTradeSettings={() => {
          document.querySelector<HTMLElement>('[data-mint="' + mint + '"]')?.scrollIntoView({
            behavior: 'smooth',
            block: 'nearest',
          });
        }}
      />
    </>
  );
}
