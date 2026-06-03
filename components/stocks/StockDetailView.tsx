'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { Skeleton } from '@/components/shared/Skeleton';
import { TokenActivityTabs } from '@/components/tokens/TokenActivityTabs';
import { StockOrderPanel } from '@/components/stocks/StockOrderPanel';
import { getSyntheticStockProvider } from '@/lib/stocks/providers';
import type { SyntheticStockCandle, SyntheticStockMarket } from '@/lib/stocks/types';
import type { TradesDeskFilter } from '@/lib/tokens/tradeFormatting';
import { cn } from '@/lib/utils/cn';

const StockChart = dynamic(
  () => import('@/components/stocks/StockChart').then((m) => ({ default: m.StockChart })),
  {
    ssr: false,
    loading: () => <Skeleton className="h-full min-h-[200px] w-full rounded-lg" />,
  },
);

const MIN_LEFT_COL = 380;
const MIN_RIGHT_STACK = 300;
const MAX_RIGHT_STACK = 580;
const H_GRIP = 4;
const MIN_CHART = 200;
const MIN_TABS = 160;
const TOKEN_DESK_VIEWPORT_RESERVE = 72;

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

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
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

function stockDeskMint(symbol: string): string {
  return `stock-desk-${symbol}`;
}

export function StockDetailView({ market }: { market: SyntheticStockMarket }) {
  const [candles, setCandles] = useState<SyntheticStockCandle[]>([]);
  const mint = stockDeskMint(market.symbol);

  useEffect(() => {
    const provider = getSyntheticStockProvider();
    void provider.getCandles(market.symbol, '15m').then(setCandles);
  }, [market.symbol]);

  const [rightStackW, setRightStackW] = useState(340);
  const [chartH, setChartH] = useState<number | null>(null);
  const [lg, setLg] = useState(false);
  const [tradesPanel, setTradesPanel] = useState(false);
  const [tradesDeskFilter, setTradesDeskFilter] = useState<TradesDeskFilter>('all');
  const [tradesAgeSortDir, setTradesAgeSortDir] = useState<'asc' | 'desc'>('desc');
  const [tradesAgeDisplay, setTradesAgeDisplay] = useState<'age' | 'time'>('age');

  const containerRef = useRef<HTMLDivElement>(null);
  const leftColRef = useRef<HTMLDivElement>(null);
  const dragCol = useRef(false);
  const startCol = useRef({ x: 0, right: 340 });
  const dragRow = useRef(false);
  const startRow = useRef({ y: 0, chartH: 300 });

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
              <StockChart candles={candles} symbol={market.symbol} edgeToEdge />
            </div>
          </div>

          <RowResizeGrip
            ariaLabel="Resize chart versus tables"
            onPointerDown={onRowDown}
            onPointerMove={onRowMove}
            onPointerUp={onRowUp}
          />

          <div className="sticky top-0 z-[8] flex h-[calc(100dvh-var(--app-bottombar-h)-72px)] min-h-[260px] max-h-[calc(100dvh-var(--app-bottombar-h)-72px)] shrink-0 flex-col overflow-hidden overscroll-y-auto border-t border-border-subtle/25 bg-bg-raised">
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              <TokenActivityTabs
                mint={mint}
                symbol={market.symbol}
                creatorWallet={null}
                dev={null}
                tradesPanel={tradesPanel}
                onTradesPanelChange={setTradesPanel}
                tradesDeskFilter={tradesDeskFilter}
                onTradesDeskFilterChange={setTradesDeskFilter}
                tradesAgeSortDir={tradesAgeSortDir}
                onTradesAgeSortDirChange={setTradesAgeSortDir}
                tradesAgeDisplay={tradesAgeDisplay}
                onTradesAgeDisplayChange={setTradesAgeDisplay}
                forceDemoTables
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
            <StockOrderPanel market={market} />
          </div>
        </div>
      </div>
    </div>
  );
}
