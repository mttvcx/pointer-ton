'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
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
import { cn } from '@/lib/utils/cn';
import { noteRecentTradeMint } from '@/store/recentTradeMints';

type LimitOrderRow = Tables<'limit_orders'>;

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
      <div className="pointer-events-none absolute left-1/2 top-0 h-full w-px -translate-x-1/2 bg-[#1b1f2a] group-hover:bg-[#38bdf8]/50" />
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
      <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-[#1b1f2a] group-hover:bg-[#38bdf8]/50" />
    </div>
  );
}

function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
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
              'flex min-w-0 flex-col bg-[#080d14] lg:min-h-0',
              lg && 'min-w-[360px] flex-1',
            )}
          >
            <div
              className={cn(
                'flex w-full min-w-0 flex-col px-0.5 pt-0.5',
                chartH != null ? 'shrink-0' : 'min-h-[200px] shrink-0',
              )}
              style={
                chartH != null
                  ? { height: chartH, minHeight: MIN_CHART, flex: '0 0 auto' }
                  : { minHeight: MIN_CHART }
              }
            >
              <TokenChart mint={mint} symbol={symbol} supplyTokens={supplyTokens ?? null} edgeToEdge />
            </div>

            <RowResizeGrip
              ariaLabel="Resize chart versus tables"
              onPointerDown={onRowDown}
              onPointerMove={onRowMove}
              onPointerUp={onRowUp}
            />

            <div className="flex min-w-0 flex-col bg-[#080d14]">
              <TokenActivityTabs
                mint={mint}
                symbol={symbol}
                creatorWallet={creatorWallet}
                dev={dev}
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
              'flex w-full min-w-0 shrink-0 flex-col border-t border-[#1b1f2a] bg-[#080d14] lg:min-h-0 lg:border-l lg:border-t-0',
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
