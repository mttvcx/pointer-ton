'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type TradesColumn = 'status' | 'name' | 'token' | 'amount' | 'marketCap' | 'averageBuy' | 'averageSell';

type TradesTableSettings = {
  columns: Record<TradesColumn, boolean>;
  amountUnit: 'SOL' | 'USD';
  setColumn: (c: TradesColumn, on: boolean) => void;
  setAmountUnit: (u: 'SOL' | 'USD') => void;
  toggleAmountUnit: () => void;
};

const DEFAULT_COLUMNS: Record<TradesColumn, boolean> = {
  status: true,
  name: true,
  token: true,
  amount: true,
  marketCap: true,
  averageBuy: false,
  averageSell: false,
};

export const useTradesTableSettings = create<TradesTableSettings>()(
  persist(
    (set) => ({
      columns: { ...DEFAULT_COLUMNS },
      amountUnit: 'SOL',
      setColumn: (c, on) => set((s) => ({ columns: { ...s.columns, [c]: on } })),
      setAmountUnit: (amountUnit) => set({ amountUnit }),
      toggleAmountUnit: () => set((s) => ({ amountUnit: s.amountUnit === 'SOL' ? 'USD' : 'SOL' })),
    }),
    { name: 'pointer.trades-table' },
  ),
);
