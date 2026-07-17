'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { defaultMarkFilters, type MarkCategory } from '@/lib/tradingview/marks';
import type { ResolutionString } from '@/types/tradingview';

/**
 * Persisted TradingView chart preferences — interval, MarketCap/Price + USD/native
 * toggles, and the bubble display options. Stored under `pointer.chart-prefs`,
 * which is in the account-sync allowlist ([[layoutSyncKeys]]), so these follow
 * the user across devices just like the workspace layout.
 */
type ChartPrefsState = {
  interval: ResolutionString;
  mode: 'price' | 'mc';
  quote: 'usd' | 'sol';
  hideAllBubbles: boolean;
  markFilters: Record<MarkCategory, boolean>;
  setInterval: (interval: ResolutionString) => void;
  setMode: (mode: 'price' | 'mc') => void;
  setQuote: (quote: 'usd' | 'sol') => void;
  setHideAllBubbles: (hide: boolean) => void;
  setMarkFilter: (key: MarkCategory, value: boolean) => void;
};

export const useChartPrefsStore = create<ChartPrefsState>()(
  persist(
    (set) => ({
      interval: '5',
      mode: 'price',
      quote: 'usd',
      hideAllBubbles: false,
      markFilters: defaultMarkFilters(),
      setInterval: (interval) => set({ interval }),
      setMode: (mode) => set({ mode }),
      setQuote: (quote) => set({ quote }),
      setHideAllBubbles: (hideAllBubbles) => set({ hideAllBubbles }),
      setMarkFilter: (key, value) =>
        set((s) => ({ markFilters: { ...s.markFilters, [key]: value } })),
    }),
    { name: 'pointer.chart-prefs' },
  ),
);
