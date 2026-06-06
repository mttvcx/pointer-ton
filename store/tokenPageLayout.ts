'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { TradesDeskFilter } from '@/lib/tokens/tradeFormatting';

type TokenPageLayoutState = {
  rightStackW: number;
  setRightStackW: (w: number) => void;
  chartH: number | null;
  setChartH: (h: number | null) => void;
  tradesPanel: boolean;
  setTradesPanel: (open: boolean) => void;
  tradesDeskFilter: TradesDeskFilter;
  setTradesDeskFilter: (f: TradesDeskFilter) => void;
  tradesAgeSortDir: 'asc' | 'desc';
  setTradesAgeSortDir: (d: 'asc' | 'desc') => void;
  tradesAgeDisplay: 'age' | 'time';
  setTradesAgeDisplay: (d: 'age' | 'time') => void;
};

const DEFAULT_RIGHT_STACK_W = 340;

export const useTokenPageLayoutStore = create<TokenPageLayoutState>()(
  persist(
    (set) => ({
      rightStackW: DEFAULT_RIGHT_STACK_W,
      setRightStackW: (rightStackW) => set({ rightStackW }),
      chartH: null,
      setChartH: (chartH) => set({ chartH }),
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
        tradesPanel: s.tradesPanel,
        tradesDeskFilter: s.tradesDeskFilter,
        tradesAgeSortDir: s.tradesAgeSortDir,
        tradesAgeDisplay: s.tradesAgeDisplay,
      }),
    },
  ),
);
