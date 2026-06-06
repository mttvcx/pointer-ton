'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PerpsBottomPanel } from '@/components/perps/PerpsBottomPanel';
import { PerpsOrderBook } from '@/components/perps/PerpsOrderBook';
import { StockChart } from '@/components/stocks/StockChart';
import { StockMarketHeader } from '@/components/stocks/StockMarketHeader';
import { StockOrderPanel } from '@/components/stocks/StockOrderPanel';
import { stockOrderbookToL2 } from '@/lib/stocks/stockPerpUi';
import { getSyntheticStockProvider } from '@/lib/stocks/providers';
import type { PerpsL2Book } from '@/lib/perps/types';
import type { SyntheticStockMarket } from '@/lib/stocks/types';

export function StockTerminal({ market }: { market: SyntheticStockMarket }) {
  const [book, setBook] = useState<PerpsL2Book | null>(null);
  const [bookLoading, setBookLoading] = useState(true);
  const [bottomSplit, setBottomSplit] = useState(0.22);
  const splitRef = useRef<HTMLDivElement>(null);
  const vertDrag = useRef(false);
  const vertStart = useRef({ y: 0, split: 0.22 });

  useEffect(() => {
    let cancelled = false;
    setBookLoading(true);
    void getSyntheticStockProvider()
      .getOrderbook(market.symbol)
      .then((ob) => {
        if (cancelled) return;
        setBook(ob ? stockOrderbookToL2(ob, market.priceUsd) : null);
        setBookLoading(false);
      })
      .catch(() => {
        if (!cancelled) setBookLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [market.symbol, market.priceUsd]);

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

  return (
    <div className="flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-bg-base text-fg-primary">
      <StockMarketHeader market={market} />

      <div ref={splitRef} className="flex min-h-0 w-full min-w-0 flex-1 flex-col">
        <div
          className="grid w-full min-w-0 min-h-0 grid-cols-1 gap-px bg-border-subtle xl:grid-cols-[minmax(0,1fr)_11rem_17.5rem]"
          style={{ flex: `${1 - bottomSplit} 1 0%` }}
        >
          <section className="flex min-h-[280px] min-w-0 flex-col bg-bg-raised xl:min-h-0">
            <StockChart symbol={market.symbol} market={market} edgeToEdge className="h-full min-h-0 flex-1" />
          </section>
          <section className="flex min-h-[180px] min-w-0 flex-col bg-bg-raised xl:min-h-0">
            <PerpsOrderBook coin={market.symbol} book={book ?? undefined} loading={bookLoading} />
          </section>
          <section className="flex min-h-[360px] min-w-0 flex-col bg-bg-raised xl:min-h-0">
            <StockOrderPanel market={market} />
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

        <div
          className="flex min-h-0 flex-col overflow-hidden bg-bg-raised"
          style={{ flex: `${bottomSplit} 1 0%`, minHeight: '6rem' }}
        >
          <PerpsBottomPanel />
        </div>
      </div>
    </div>
  );
}
