'use client';

import { useVirtualizer } from '@tanstack/react-virtual';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Search, SlidersHorizontal } from 'lucide-react';
import { EmptyState } from '@/components/shared/EmptyState';
import { STOCK_PULSE_ROW_SLOT_PX, StockRow } from '@/components/stocks/StockRow';
import type { SyntheticStockCategory, SyntheticStockMarket } from '@/lib/stocks/types';
import { STOCK_CATEGORY_LABEL } from '@/lib/stocks/types';
import { PULSE_COLUMN_ACCENT_DOT, type PulseColumnId } from '@/lib/utils/constants';
import { cn } from '@/lib/utils/cn';
import { usePulseColumnStore } from '@/store/pulseColumns';

const STOCK_TO_PULSE_COLUMN: Record<SyntheticStockCategory, PulseColumnId> = {
  pre_ipo: 'new',
  hot: 'stretch',
  top: 'migrated',
};

function filterMarkets(
  rows: SyntheticStockMarket[],
  category: SyntheticStockCategory,
  query: string,
): SyntheticStockMarket[] {
  const q = query.trim().toLowerCase();
  return rows.filter((m) => {
    if (m.category !== category) return false;
    if (!q) return true;
    return m.symbol.toLowerCase().includes(q) || m.name.toLowerCase().includes(q);
  });
}

export function StocksPulseColumn({
  category,
  markets,
}: {
  category: SyntheticStockCategory;
  markets: SyntheticStockMarket[];
}) {
  const pulseColumn = STOCK_TO_PULSE_COLUMN[category];
  const listMountRef = useRef<HTMLDivElement>(null);
  const scrollMainRef = useRef<Element | null>(null);
  const [search, setSearch] = useState('');
  const [defaultLeverage, setDefaultLeverage] = useState(5);
  const presetSlot = usePulseColumnStore((s) => s.byColumn?.[pulseColumn]?.presetSlot ?? 1);
  const setPresetSlot = usePulseColumnStore((s) => s.setPresetSlot);

  const visibleRows = useMemo(
    () => filterMarkets(markets, category, search),
    [markets, category, search],
  );

  const rowSize = STOCK_PULSE_ROW_SLOT_PX;

  const rowVirtualizer = useVirtualizer({
    count: visibleRows.length,
    getScrollElement: () => scrollMainRef.current as HTMLElement | null,
    estimateSize: () => rowSize,
    overscan: 10,
    getItemKey: (index) => visibleRows[index]?.symbol ?? `empty:${index}`,
  });

  useLayoutEffect(() => {
    scrollMainRef.current = listMountRef.current ?? document.documentElement;
    rowVirtualizer.measure();
  }, [rowVirtualizer, category, pulseColumn]);

  useEffect(() => {
    rowVirtualizer.measure();
  }, [rowVirtualizer, visibleRows.length, rowSize]);

  const dotClass = PULSE_COLUMN_ACCENT_DOT[pulseColumn];
  const title = STOCK_CATEGORY_LABEL[category];

  return (
    <section className="pulse-column flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-raised">
      <header className="sticky top-0 z-[40] shrink-0 space-y-2 border-b border-white/[0.1] bg-bg-hover px-3 py-2 shadow-[inset_0_-1px_0_0_rgba(255,255,255,0.05),0_6px_12px_-8px_rgba(0,0,0,0.85)]">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
          <div className="flex min-w-0 items-center gap-2">
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dotClass)} aria-hidden />
            <h2 className="text-[13px] font-semibold uppercase tracking-wide text-fg-primary">
              {title}
            </h2>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol or name..."
            className={cn(
              'min-w-[100px] max-w-[14rem] flex-1 rounded-full border border-transparent px-3 py-1.5 text-[12px] text-fg-primary outline-none transition-all duration-150',
              'bg-white/5 placeholder:text-fg-muted/50 focus:border-transparent focus:bg-white/[0.08] focus:ring-1 focus:ring-accent-primary/25',
              'hover:border-white/15',
            )}
            aria-label={`Search ${title}`}
          />
          <label
            className={cn(
              'flex min-h-[2.125rem] shrink-0 items-center gap-1.5 rounded-full border border-transparent px-2.5 py-1.5 transition-all duration-150',
              'bg-white/5 hover:border-white/15 focus-within:border-transparent focus-within:bg-white/[0.08] focus-within:ring-1 focus-within:ring-accent-primary/25',
            )}
            title={`Default leverage for ${title}`}
          >
            <span className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">Lev</span>
            <input
              type="number"
              inputMode="decimal"
              step="0.5"
              min={1}
              max={20}
              value={defaultLeverage}
              onChange={(e) => {
                const next = Number(e.target.value);
                setDefaultLeverage(
                  Number.isFinite(next) ? Math.min(20, Math.max(1, next)) : 5,
                );
              }}
              className="w-8 min-w-0 bg-transparent text-[12px] font-medium tabular-nums text-fg-primary outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              aria-label={`Default leverage for ${title}`}
            />
            <span className="text-[11px] font-medium text-fg-muted">x</span>
          </label>
          <div className="flex shrink-0 items-center gap-0.5">
            {([1, 2, 3] as const).map((slot) => (
              <button
                key={slot}
                type="button"
                onClick={() => setPresetSlot(pulseColumn, slot)}
                className={cn(
                  'btn-press focus-ring rounded-md border px-2 py-1 text-[10px] font-semibold leading-none transition',
                  presetSlot === slot
                    ? 'border-accent-primary/50 bg-accent-primary/10 text-accent-primary'
                    : 'border-border-subtle text-fg-muted hover:border-border-default hover:text-fg-secondary',
                )}
              >
                P{slot}
              </button>
            ))}
            <button
              type="button"
              disabled
              className="btn-press focus-ring flex h-8 w-8 cursor-not-allowed items-center justify-center rounded-md text-fg-muted/50 opacity-60"
              aria-label="Column filters (stocks demo)"
            >
              <SlidersHorizontal className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </div>
      </header>

      <div
        ref={listMountRef}
        className="min-h-0 w-full flex-1 overflow-y-auto overflow-x-hidden overscroll-contain bg-bg-raised"
      >
        {visibleRows.length === 0 ? (
          <EmptyState
            icon={Search}
            title="No matches"
            description="Try a different ticker or company name."
            className="py-12"
          />
        ) : (
          <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
            {rowVirtualizer.getVirtualItems().map((vi) => {
              const market = visibleRows[vi.index];
              if (!market) return null;
              return (
                <div
                  key={market.symbol}
                  data-index={vi.index}
                  className="absolute left-0 top-0 z-0 isolate w-full overflow-visible bg-bg-raised hover:z-30"
                  style={{
                    transform: `translate3d(0, ${vi.start}px, 0)`,
                    height: rowSize,
                  }}
                >
                  <StockRow market={market} defaultLeverage={defaultLeverage} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}
