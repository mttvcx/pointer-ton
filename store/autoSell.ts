'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_AUTO_SELL_PREFS,
  type AutoSellPrefs,
  type AutoSellRule,
} from '@/lib/autoSell/types';

type AutoSellState = AutoSellPrefs & {
  setPrefs: (patch: Partial<AutoSellPrefs>) => void;
  addRule: (rule: AutoSellRule) => void;
  updateRule: (id: string, patch: Partial<AutoSellRule>) => void;
  removeRule: (id: string) => void;
};

export const useAutoSellStore = create<AutoSellState>()(
  persist(
    (set) => ({
      ...DEFAULT_AUTO_SELL_PREFS,
      setPrefs: (patch) => set((s) => ({ ...s, ...patch })),
      addRule: (rule) => set((s) => ({ rules: [...s.rules, rule] })),
      updateRule: (id, patch) =>
        set((s) => ({
          rules: s.rules.map((r) => (r.id === id ? { ...r, ...patch } : r)),
        })),
      removeRule: (id) => set((s) => ({ rules: s.rules.filter((r) => r.id !== id) })),
    }),
    {
      name: 'pointer.auto-sell',
      partialize: (s) => ({
        autoSellEnabled: s.autoSellEnabled,
        rules: s.rules,
        cooldownSec: s.cooldownSec,
      }),
      merge: (persisted, current) => ({
        ...current,
        ...DEFAULT_AUTO_SELL_PREFS,
        ...(persisted as Partial<AutoSellPrefs>),
      }),
    },
  ),
);
