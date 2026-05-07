'use client';

import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils/cn';

type TickerRow = {
  symbol: string;
  usdPrice: number | null;
  priceChange24h: number | null;
};

export function PriceTickerBar() {
  const query = useQuery({
    queryKey: ['jupiter-tickers'],
    queryFn: async (): Promise<TickerRow[]> => {
      const res = await fetch('/api/prices/tickers');
      const json: unknown = await res.json();
      const arr =
        json && typeof json === 'object' && 'tickers' in json
          ? (json as { tickers: TickerRow[] }).tickers
          : [];
      return Array.isArray(arr) ? arr : [];
    },
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const rows = query.data ?? [];

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-40 flex h-8 max-h-8 items-center justify-center gap-6 border-t border-border-subtle bg-bg-base px-4 text-[11px] tabular-nums text-fg-secondary transition-colors duration-150"
      aria-live="polite"
    >
      {query.isLoading && !query.data ? (
        <div className="flex items-center gap-6">
          {['a', 'b', 'c'].map((k) => (
            <span
              key={k}
              className="inline-flex items-baseline gap-1.5"
              aria-hidden
            >
              <span className="skeleton h-3 w-8 rounded-sm" />
              <span className="skeleton h-3 w-14 rounded-sm" />
              <span className="skeleton h-3 w-10 rounded-sm" />
            </span>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <span className="text-fg-muted">Prices unavailable</span>
      ) : (
        rows.map((t) => <TickerCell key={t.symbol} row={t} />)
      )}
    </div>
  );
}

function TickerCell({ row }: { row: TickerRow }) {
  const ch = row.priceChange24h;
  const pct =
    ch != null && Number.isFinite(ch)
      ? `${ch >= 0 ? '+' : ''}${ch.toFixed(2)}%`
      : '\u2014';
  const price =
    row.usdPrice != null && Number.isFinite(row.usdPrice)
      ? `$${row.usdPrice < 1000 ? row.usdPrice.toFixed(2) : row.usdPrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
      : '\u2014';

  return (
    <span className="inline-flex items-baseline gap-1.5">
      <span className="font-semibold uppercase tracking-wide text-fg-muted">{row.symbol}</span>
      <span className="tabular-nums text-fg-primary">{price}</span>
      <span
        className={cn(
          'tabular-nums transition-colors duration-150',
          ch != null && ch > 0
            ? 'text-signal-bull'
            : ch != null && ch < 0
              ? 'text-signal-bear'
              : 'text-fg-muted',
        )}
      >
        {pct}
      </span>
    </span>
  );
}
