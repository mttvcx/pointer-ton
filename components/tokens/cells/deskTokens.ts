/**
 * Shared desk-table constants used across all bottom-panel tabs.
 * Typography: system-ui condensed + tabular-nums (Axiom parity — light weights).
 */

export const DESK_ROW_CLASS =
  'group h-9 border-b border-border-subtle/40 bg-transparent transition-colors hover:bg-bg-hover/60';

export const DESK_CELL_CLASS = 'px-2.5 py-1.5 align-middle';
export const DESK_CELL_FIRST_CLASS = 'pl-3 pr-2 py-1.5 align-middle';
export const DESK_CELL_LAST_CLASS = 'pl-2 pr-3 py-1.5 align-middle';

/** Slim, data-dense table root — apply on every bottom-panel `<table>`. */
export const DESK_TABLE_CLASS =
  'font-[system-ui] font-stretch-condensed tabular-nums';

export const DESK_HEADER_CLASS =
  'px-2.5 py-2 text-[11px] font-normal uppercase tracking-wide text-fg-muted text-left font-sans';

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

/** Opaque sticky thead — rows scroll underneath without bleed-through. */
export const DESK_STICKY_HEAD_CLASS =
  'sticky top-0 z-20 bg-bg-base shadow-[0_1px_0_rgba(255,255,255,0.04)]';
