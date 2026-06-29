'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TradesDeskFilter } from '@/lib/tokens/tradeFormatting';

type TokenPageLayoutState = {
  rightStackW: number;
  setRightStackW: (w: number) => void;
  chartH: number | null;
  setChartH: (h: number | null) => void;
  /** Width (px) of the holder bubble-map slide-out (Axiom-style, drag-resizable). */
  bubbleMapW: number;
  setBubbleMapW: (w: number) => void;
  tradesPanel: boolean;
  setTradesPanel: (open: boolean) => void;
  tradesDeskFilter: TradesDeskFilter;
  setTradesDeskFilter: (f: TradesDeskFilter) => void;
  tradesAgeSortDir: 'asc' | 'desc';
  setTradesAgeSortDir: (d: 'asc' | 'desc') => void;
  tradesAgeDisplay: 'age' | 'time';
  setTradesAgeDisplay: (d: 'age' | 'time') => void;
};

const DEFAULT_RIGHT_STACK_W = 420;
/** Legacy default — bump on rehydrate so PnL strip isn't squished. */
const LEGACY_RIGHT_STACK_W = 340;
/** Bubble-map slide-out default width (clamped in the component). */
export const DEFAULT_BUBBLE_MAP_W = 520;
export const MIN_BUBBLE_MAP_W = 360;
export const MAX_BUBBLE_MAP_W = 920;

export const useTokenPageLayoutStore = create<TokenPageLayoutState>()(
  persist(
    (set) => ({
      rightStackW: DEFAULT_RIGHT_STACK_W,
      setRightStackW: (rightStackW) => set({ rightStackW }),
      chartH: null,
      setChartH: (chartH) => set({ chartH }),
      bubbleMapW: DEFAULT_BUBBLE_MAP_W,
      setBubbleMapW: (bubbleMapW) => set({ bubbleMapW }),
      tradesPanel: true,
      setTradesPanel: (tradesPanel) => set({ tradesPanel }),
      tradesDeskFilter: 'all',
      setTradesDeskFilter: (tradesDeskFilter) => set({ tradesDeskFilter }),
      tradesAgeSortDir: 'desc',
      setTradesAgeSortDir: (tradesAgeSortDir) => set({ tradesAgeSortDir }),
      tradesAgeDisplay: 'age',
      setTradesAgeDisplay: (tradesAgeDisplay) => set({ tradesAgeDisplay }),
    }),
    {
      name: 'pointer.token-page-layout',
      partialize: (s) => ({
        rightStackW: s.rightStackW,
        chartH: s.chartH,
        bubbleMapW: s.bubbleMapW,
        tradesPanel: s.tradesPanel,
        tradesDeskFilter: s.tradesDeskFilter,
        tradesAgeSortDir: s.tradesAgeSortDir,
        tradesAgeDisplay: s.tradesAgeDisplay,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<TokenPageLayoutState> | undefined;
        const savedW = p?.rightStackW;
        const rightStackW =
          savedW == null || savedW <= LEGACY_RIGHT_STACK_W
            ? DEFAULT_RIGHT_STACK_W
            : savedW;
        return { ...current, ...p, rightStackW };
      },
    },
  ),
);
