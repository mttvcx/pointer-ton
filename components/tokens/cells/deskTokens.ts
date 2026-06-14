/**
 * Shared desk-table constants used across all bottom-panel tabs.
 * Typography: system-ui condensed + tabular-nums (Axiom parity — light weights).
 */

import { cn } from '@/lib/utils/cn';

/** Alternating desk rows — checkered grey/black (Axiom parity). */
export function deskRowClass(index: number, extra?: string) {
  return cn(
    'group h-9 w-full border-b border-border-subtle/25 transition-colors',
    index % 2 === 0 ? 'bg-desk-a hover:bg-bg-hover/55' : 'bg-desk-b hover:bg-bg-hover/55',
    extra,
  );
}

/** @deprecated Prefer `deskRowClass(index)` for zebra striping. */
export const DESK_ROW_CLASS = deskRowClass(0);

export const DESK_CELL_CLASS = 'px-2.5 py-1.5 align-middle';
export const DESK_CELL_FIRST_CLASS = 'pl-3 pr-2 py-1.5 align-middle';
export const DESK_CELL_LAST_CLASS = 'pl-2 pr-3 py-1.5 align-middle';

/** Slim, data-dense table root — apply on every bottom-panel `<table>`. */
export const DESK_TABLE_CLASS =
  'font-[system-ui] font-stretch-condensed tabular-nums';

export const DESK_HEADER_CLASS =
  'px-2.5 py-1 text-[10px] font-normal uppercase tracking-wide text-fg-muted text-left font-sans';

export const DESK_HEADER_NUM_CLASS = `${DESK_HEADER_CLASS} text-right`;

/** Sans + tabular figures — default for all desk cell text. */
export const DESK_TABULAR = 'font-sans tabular-nums';

/** Primary value — line 1 in stacked cells. */
export const CELL_PRIMARY_CLASS =
  'text-[12px] font-normal text-fg-primary leading-tight font-sans tabular-nums';

/** Secondary line — qty/n, last active, funding meta, etc. */
export const CELL_SECONDARY_CLASS =
  'text-[10.5px] font-normal text-fg-muted leading-tight font-sans tabular-nums';

/** Tertiary line — avg price in parens. */
export const CELL_TERTIARY_CLASS =
  'text-[10.5px] font-normal text-fg-muted/70 leading-tight font-sans tabular-nums';

/** Wallet / address labels in desk rows. */
export const CELL_WALLET_CLASS =
  'text-[12px] font-normal text-fg-secondary leading-tight font-sans tracking-normal';

/** Age / rank / muted timestamps. */
export const CELL_MUTED_CLASS =
  'text-[11px] font-normal text-fg-muted leading-tight font-sans tabular-nums';

/** Hero PnL value (Top Traders R.PnL, Holders U.PnL). */
export const CELL_HERO_CLASS =
  'text-[14px] font-medium leading-tight font-sans tabular-nums';

/** Sticky thead — flat on desk panel, hairline separator only (Axiom parity). */
export const DESK_STICKY_HEAD_CLASS =
  'sticky top-0 z-20 bg-desk-panel shadow-[0_1px_0_rgb(var(--border-subtle-rgb)/0.28)]';

/**
 * Mint trades desk — six columns, full width (Axiom parity).
 * Age/Time · Type · MC/Price · Amount · Total SOL/USD · Trader
 */
export const TRADES_DESK_GRID_COLS =
  'minmax(5.25rem,0.58fr) minmax(3.25rem,0.42fr) minmax(4.25rem,0.68fr) minmax(4.75rem,0.82fr) minmax(5.5rem,1fr) minmax(9rem,1.5fr)';

/** Trades row height + horizontal breathing room (14–16px). */
export const TRADES_DESK_ROW_H = 'h-9';
export const TRADES_DESK_CELL_PX = 'px-4';

export const TRADES_DESK_HEADER_CELL = cn(
  TRADES_DESK_ROW_H,
  TRADES_DESK_CELL_PX,
  'flex min-w-0 items-center gap-1.5 text-[10px] font-normal uppercase tracking-wide text-fg-muted',
);

export const TRADES_DESK_BODY_CELL = cn(
  TRADES_DESK_ROW_H,
  TRADES_DESK_CELL_PX,
  'flex min-w-0 items-center gap-1.5',
);

/** Scroll region — no nested border/inset; inherits desk panel background. */
export const DESK_SCROLL_WELL_CLASS =
  'relative min-h-0 flex-1 overflow-x-auto overflow-y-auto overscroll-y-auto touch-pan-y [scrollbar-gutter:stable] [-ms-overflow-style:auto] [scrollbar-width:thin] [scrollbar-color:rgb(var(--border-strong-rgb)/0.4)_transparent]';
