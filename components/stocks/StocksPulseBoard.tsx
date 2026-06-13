'use client';

import { useEffect, useState } from 'react';
import { getSyntheticStockProvider } from '@/lib/stocks/providers';
import type { SyntheticStockCategory, SyntheticStockMarket } from '@/lib/stocks/types';
import { StocksPulseColumn } from '@/components/stocks/StocksPulseColumn';

const COLUMNS: SyntheticStockCategory[] = ['pre_ipo', 'hot', 'top'];

export function StocksPulseBoard() {
  const [markets, setMarkets] = useState<SyntheticStockMarket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const provider = getSyntheticStockProvider();
    void provider.getMarkets().then((rows) => {
      setMarkets(rows);
      setLoading(false);
    });
  }, []);

  if (loading) {
    return (
      <>
        {COLUMNS.map((cat) => (
          <section
            key={cat}
            className="pulse-column flex h-full min-h-0 min-w-0 flex-1 animate-pulse flex-col rounded-lg border border-t-0 border-border-subtle bg-bg-raised"
          >
            <div className="h-14 bg-bg-hover" />
            <div className="flex-1 bg-bg-raised/50" />
          </section>
        ))}
      </>
    );
  }

  return (
    <>
      {COLUMNS.map((cat) => (
        <StocksPulseColumn key={cat} category={cat} markets={markets} />
      ))}
    </>
  );
}
