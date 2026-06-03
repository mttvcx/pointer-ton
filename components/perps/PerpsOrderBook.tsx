'use client';

import type { PerpsL2Book } from '@/lib/perps/types';
import { cn } from '@/lib/utils/cn';
import { formatNumber } from '@/lib/utils/formatters';
import { Skeleton } from '@/components/shared/Skeleton';

function priceDecimals(px: number): number {
  if (px >= 5000) return 0;
  if (px >= 500) return 1;
  if (px >= 1) return 2;
  return 4;
}

function LevelRow({
  px,
  sz,
  totalUsd,
  side,
  depthPct,
}: {
  px: number;
  sz: number;
  totalUsd: number;
  side: 'bid' | 'ask';
  depthPct: number;
}) {
  const dec = priceDecimals(px);
  return (
    <div
      className={cn(
        'relative grid grid-cols-[1fr_1fr_1fr] items-center gap-1 px-2 py-[2px] text-[10px] tabular-nums',
        side === 'ask' ? 'text-signal-bear' : 'text-signal-bull',
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-y-0 right-0',
          side === 'ask' ? 'bg-signal-bear/10' : 'bg-signal-bull/10',
        )}
        style={{ width: `${depthPct}%` }}
      />
      <span className="relative z-[1] font-medium">{formatNumber(px, { decimals: dec })}</span>
      <span className="relative z-[1] text-right font-medium text-fg-secondary">
        {formatNumber(sz, { decimals: sz >= 1 ? 3 : 4 })}
      </span>
      <span className="relative z-[1] text-right text-fg-muted">
        {totalUsd >= 1e6
          ? `${(totalUsd / 1e6).toFixed(2)}m`
          : totalUsd >= 1e3
            ? `${(totalUsd / 1e3).toFixed(1)}k`
            : totalUsd.toFixed(0)}
      </span>
    </div>
  );
}

export function PerpsOrderBook({
  coin,
  book,
  loading,
}: {
  coin: string;
  book: PerpsL2Book | undefined;
  loading: boolean;
}) {
  const dec = priceDecimals(book?.mark ?? 1);
  const maxSz = Math.max(
    ...(book?.asks ?? []).map((l) => l.sz),
    ...(book?.bids ?? []).map((l) => l.sz),
    1,
  );

  const asks = [...(book?.asks ?? [])].sort((a, b) => b.px - a.px).slice(0, 12);
  const bids = (book?.bids ?? []).slice(0, 12);

  let askCum = 0;
  const askRows = asks.map((l) => {
    askCum += l.px * l.sz;
    return { ...l, totalUsd: askCum, depthPct: Math.min(100, (l.sz / maxSz) * 100) };
  });

  let bidCum = 0;
  const bidRows = bids.map((l) => {
    bidCum += l.px * l.sz;
    return { ...l, totalUsd: bidCum, depthPct: Math.min(100, (l.sz / maxSz) * 100) };
  });

  return (
    <div className="flex min-h-0 min-w-0 flex-col overflow-hidden bg-bg-raised">
      <header className="flex items-center justify-between border-b border-border-subtle px-2 py-1.5">
        <h2 className="text-[11px] font-semibold text-fg-secondary">Order book</h2>
        <span className="text-[9px] text-fg-muted">Hyperliquid L2</span>
      </header>

      <div className="grid grid-cols-[1fr_1fr_1fr] gap-1 border-b border-border-subtle/80 px-2 py-1 text-[8px] font-semibold uppercase tracking-wide text-fg-muted">
        <span>Price</span>
        <span className="text-right">Size ({coin})</span>
        <span className="text-right">Total (USD)</span>
      </div>

      {loading && !book ? (
        <div className="space-y-1 p-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-4 w-full rounded-sm" />
          ))}
        </div>
      ) : (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {askRows.map((l, i) => (
              <LevelRow key={`a-${i}`} px={l.px} sz={l.sz} totalUsd={l.totalUsd} side="ask" depthPct={l.depthPct} />
            ))}
          </div>
          <div className="shrink-0 border-y border-border-subtle bg-bg-sunken/50 px-2 py-1 text-center">
            <span className="text-[10px] font-semibold text-fg-secondary">Spread</span>
            <span className="mx-1.5 text-fg-muted">·</span>
            <span className="text-[10px] tabular-nums text-fg-primary">
              {book ? `${book.spreadBps.toFixed(1)} bps` : '—'}
            </span>
            {book ? (
              <>
                <span className="mx-1.5 text-fg-muted">·</span>
                <span className="text-[10px] tabular-nums text-fg-muted">
                  {formatNumber(book.mark, { decimals: dec })}
                </span>
              </>
            ) : null}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {bidRows.map((l, i) => (
              <LevelRow key={`b-${i}`} px={l.px} sz={l.sz} totalUsd={l.totalUsd} side="bid" depthPct={l.depthPct} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
