'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import { PerpsMarketHeader } from '@/components/perps/PerpsMarketHeader';
import { PerpsChartPanel, TIMEFRAMES } from '@/components/perps/PerpsChartPanel';
import { PerpsOrderBook } from '@/components/perps/PerpsOrderBook';
import { PerpsOrderPanel } from '@/components/perps/PerpsOrderPanel';
import { PerpsBottomPanel } from '@/components/perps/PerpsBottomPanel';
import { usePerpsL2Book, usePerpsMarkets } from '@/lib/hooks/usePerpsMarkets';
import { PERPS_PINNED_COINS } from '@/lib/hyperliquid/constants';
import { perpMarketId } from '@/lib/perps/coinMeta';
import type { PerpMarket } from '@/lib/perps/types';
import { Skeleton } from '@/components/shared/Skeleton';

export function PerpsTerminal() {
  const marketsQ = usePerpsMarkets();
  const [pairId, setPairId] = useState<string | null>(null);
  const [tf, setTf] = useState<(typeof TIMEFRAMES)[number]>('15m');
  const [bottomSplit, setBottomSplit] = useState(0.22);
  const splitRef = useRef<HTMLDivElement>(null);
  const vertDrag = useRef(false);
  const vertStart = useRef({ y: 0, split: 0.22 });

  const markets = marketsQ.data ?? [];

  const resolvedPairId = useMemo(() => {
    if (pairId && markets.some((m) => m.id === pairId)) return pairId;
    const btc = markets.find((m) => m.coin === 'BTC');
    if (btc) return btc.id;
    return markets[0]?.id ?? null;
  }, [markets, pairId]);

  const pair: PerpMarket | null = useMemo(
    () => (resolvedPairId ? markets.find((m) => m.id === resolvedPairId) ?? null : null),
    [markets, resolvedPairId],
  );

  const l2Q = usePerpsL2Book(pair?.coin ?? '', pair?.mark ?? 0, Boolean(pair));

  const onVertDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      vertDrag.current = true;
      vertStart.current = { y: e.clientY, split: bottomSplit };
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [bottomSplit],
  );

  const onVertMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!vertDrag.current || !splitRef.current) return;
    const h = Math.max(1, splitRef.current.getBoundingClientRect().height);
    const dy = e.clientY - vertStart.current.y;
    const next = vertStart.current.split + dy / h;
    setBottomSplit(Math.min(0.48, Math.max(0.14, next)));
  }, []);

  const onVertUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    vertDrag.current = false;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
  }, []);

  if (marketsQ.isPending && !markets.length) {
    return <PerpsTerminalSkeleton />;
  }

  if (marketsQ.isError || !pair) {
    return (
      <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 bg-bg-base px-4 text-center">
        <p className="text-sm font-semibold text-fg-primary">Could not load Hyperliquid markets</p>
        <p className="max-w-md text-[12px] text-fg-muted">
          {marketsQ.error instanceof Error ? marketsQ.error.message : 'Check your connection and retry.'}
        </p>
        <button
          type="button"
          onClick={() => void marketsQ.refetch()}
          className="mt-2 rounded-md bg-accent-primary px-4 py-2 text-[12px] font-semibold text-fg-inverse"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-bg-base text-fg-primary">
      <PerpsMarketHeader
        markets={markets}
        pair={pair}
        pairId={resolvedPairId!}
        onSelectPair={setPairId}
      />

      <div ref={splitRef} className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
        <div
          className="grid w-full min-w-0 min-h-0 grid-cols-1 gap-px bg-border-subtle xl:grid-cols-[minmax(0,1fr)_11rem_17.5rem]"
          style={{ flex: `${1 - bottomSplit} 1 0%` }}
        >
          <section className="flex min-h-[280px] min-w-0 flex-col xl:min-h-0">
            <PerpsChartPanel pair={pair} tf={tf} onTfChange={setTf} />
          </section>
          <section className="flex min-h-[180px] min-w-0 flex-col xl:min-h-0">
            <PerpsOrderBook coin={pair.coin} book={l2Q.data} loading={l2Q.isPending} />
          </section>
          <section className="flex min-h-[360px] min-w-0 flex-col xl:min-h-0">
            <PerpsOrderPanel pair={pair} />
          </section>
        </div>

        <div
          role="separator"
          aria-label="Resize chart versus positions"
          onPointerDown={onVertDown}
          onPointerMove={onVertMove}
          onPointerUp={onVertUp}
          onPointerCancel={onVertUp}
          className="group relative z-10 hidden h-1 shrink-0 cursor-row-resize xl:block"
        >
          <div className="pointer-events-none absolute left-0 top-1/2 h-px w-full -translate-y-1/2 bg-border-subtle group-hover:bg-accent-primary/45" />
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden" style={{ flex: `${bottomSplit} 1 0%`, minHeight: '6rem' }}>
          <PerpsBottomPanel />
        </div>
      </div>
    </div>
  );
}

function PerpsTerminalSkeleton() {
  return (
    <div className="flex min-h-full flex-col bg-bg-base">
      <div className="border-b border-border-subtle px-2 py-2">
        <Skeleton className="h-8 w-48 rounded-md" />
      </div>
      <div className="grid flex-1 grid-cols-1 gap-px bg-border-subtle xl:grid-cols-[1fr_11rem_17.5rem]">
        <Skeleton className="min-h-[280px] rounded-none bg-bg-raised" />
        <Skeleton className="min-h-[200px] rounded-none bg-bg-raised" />
        <Skeleton className="min-h-[320px] rounded-none bg-bg-raised" />
      </div>
    </div>
  );
}

/** Default pair id once markets load */
export function defaultPerpPairId(markets: PerpMarket[]): string {
  const pinned = PERPS_PINNED_COINS.map((c) => markets.find((m) => m.coin === c)).find(Boolean);
  return pinned?.id ?? markets[0]?.id ?? perpMarketId('BTC');
}
