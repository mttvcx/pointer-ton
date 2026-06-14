export type WatchlistQuickbuyMode = 'never' | 'always' | 'hover';

export type WatchlistSortKey = 'price' | 'added' | 'symbol';

export type WatchlistSortDir = 'asc' | 'desc';

/** Which dataset fills the ticker row under the top bar (Axiom-style mode toggles). */
export type TickerBarMode = 'watchlist' | 'active_positions' | 'recent_pairs';

export type WatchlistItem = {
  mint: string;
  symbol: string | null;
  name: string | null;
  imageUrl: string | null;
  marketCapUsd: number | null;
  addedAt: number;
};

export type WatchlistSettings = {
  showTicker: boolean;
  quickbuyMode: WatchlistQuickbuyMode;
  showActivePositionMc: boolean;
  sortKey: WatchlistSortKey;
  sortDir: WatchlistSortDir;
  /** Active mode for the row under the header. */
  tickerMode: TickerBarMode;
};

export const DEFAULT_WATCHLIST_SETTINGS: WatchlistSettings = {
  showTicker: true,
  quickbuyMode: 'hover',
  showActivePositionMc: false,
  sortKey: 'added',
  sortDir: 'desc',
  tickerMode: 'watchlist',
};

export const WATCHLIST_MAX_ITEMS = 24;

export function cloneWatchlistSettings(s: WatchlistSettings): WatchlistSettings {
  return { ...s };
}
