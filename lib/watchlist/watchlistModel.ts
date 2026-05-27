export type WatchlistQuickbuyMode = 'never' | 'always' | 'hover';

export type WatchlistSortKey = 'price' | 'added' | 'symbol';

export type WatchlistSortDir = 'asc' | 'desc';

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
};

export const DEFAULT_WATCHLIST_SETTINGS: WatchlistSettings = {
  showTicker: true,
  quickbuyMode: 'hover',
  showActivePositionMc: false,
  sortKey: 'added',
  sortDir: 'desc',
};

export const WATCHLIST_MAX_ITEMS = 24;

export function cloneWatchlistSettings(s: WatchlistSettings): WatchlistSettings {
  return { ...s };
}
