'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  cloneWatchlistSettings,
  DEFAULT_WATCHLIST_SETTINGS,
  WATCHLIST_MAX_ITEMS,
  type WatchlistItem,
  type WatchlistQuickbuyMode,
  type WatchlistSettings,
  type WatchlistSortDir,
  type WatchlistSortKey,
  type TickerBarMode,
} from '@/lib/watchlist/watchlistModel';

type AddWatchlistInput = {
  mint: string;
  symbol?: string | null;
  name?: string | null;
  imageUrl?: string | null;
  marketCapUsd?: number | null;
};

type WatchlistState = {
  items: WatchlistItem[];
  settings: WatchlistSettings;
  addItem: (input: AddWatchlistInput) => boolean;
  removeItem: (mint: string) => void;
  toggleItem: (input: AddWatchlistInput) => boolean;
  isWatchlisted: (mint: string) => boolean;
  updateItemMarketCap: (mint: string, marketCapUsd: number | null) => void;
  setShowTicker: (show: boolean) => void;
  setQuickbuyMode: (mode: WatchlistQuickbuyMode) => void;
  setShowActivePositionMc: (show: boolean) => void;
  setTickerMode: (mode: TickerBarMode) => void;
  setSort: (key: WatchlistSortKey, dir: WatchlistSortDir) => void;
  resetSettings: () => void;
};

export const useWatchlistStore = create<WatchlistState>()(
  persist(
    (set, get) => ({
      items: [],
      settings: cloneWatchlistSettings(DEFAULT_WATCHLIST_SETTINGS),

      addItem: (input) => {
        const mint = input.mint?.trim() ?? '';
        if (mint.length < 32) return false;
        const existing = get().items.find((i) => i.mint === mint);
        if (existing) return false;

        const item: WatchlistItem = {
          mint,
          symbol: input.symbol?.trim() || null,
          name: input.name?.trim() || null,
          imageUrl: input.imageUrl ?? null,
          marketCapUsd:
            input.marketCapUsd != null && Number.isFinite(input.marketCapUsd)
              ? input.marketCapUsd
              : null,
          addedAt: Date.now(),
        };

        const next = [item, ...get().items].slice(0, WATCHLIST_MAX_ITEMS);
        set({ items: next });
        return true;
      },

      removeItem: (mint) => {
        set({ items: get().items.filter((i) => i.mint !== mint) });
      },

      toggleItem: (input) => {
        const mint = input.mint?.trim() ?? '';
        if (!mint) return false;
        if (get().items.some((i) => i.mint === mint)) {
          get().removeItem(mint);
          return false;
        }
        return get().addItem(input);
      },

      isWatchlisted: (mint) => get().items.some((i) => i.mint === mint),

      updateItemMarketCap: (mint, marketCapUsd) => {
        set({
          items: get().items.map((i) =>
            i.mint === mint
              ? {
                  ...i,
                  marketCapUsd:
                    marketCapUsd != null && Number.isFinite(marketCapUsd)
                      ? marketCapUsd
                      : i.marketCapUsd,
                }
              : i,
          ),
        });
      },

      setShowTicker: (showTicker) =>
        set({ settings: { ...get().settings, showTicker } }),

      setQuickbuyMode: (quickbuyMode) =>
        set({ settings: { ...get().settings, quickbuyMode } }),

      setShowActivePositionMc: (showActivePositionMc) =>
        set({ settings: { ...get().settings, showActivePositionMc } }),

      setTickerMode: (tickerMode) =>
        set({ settings: { ...get().settings, tickerMode, showTicker: true } }),

      setSort: (sortKey, sortDir) =>
        set({ settings: { ...get().settings, sortKey, sortDir } }),

      resetSettings: () =>
        set({ settings: cloneWatchlistSettings(DEFAULT_WATCHLIST_SETTINGS) }),
    }),
    {
      name: 'pointer-watchlist',
      partialize: (s) => ({ items: s.items, settings: s.settings }),
    },
  ),
);

export function isMintWatchlisted(mint: string): boolean {
  return useWatchlistStore.getState().isWatchlisted(mint);
}
