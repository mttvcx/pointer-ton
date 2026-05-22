'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AutoBuyPrefs = {
  autoBuyEnabled: boolean;
  defaultAutoBuySol: number;
  autoBuyDailyCapSol: number;
  autoBuyCooldownSec: number;
};

export const DEFAULT_AUTO_BUY_PREFS: AutoBuyPrefs = {
  autoBuyEnabled: false,
  defaultAutoBuySol: 0.1,
  autoBuyDailyCapSol: 5,
  autoBuyCooldownSec: 30,
};

type DailyLedger = {
  utcDate: string;
  spentSol: number;
  buyCount: number;
};

type AutoBuyState = AutoBuyPrefs & {
  daily: DailyLedger;
  setPrefs: (patch: Partial<AutoBuyPrefs>) => void;
  recordAutoBuySpend: (amountSol: number) => void;
  getTodayStats: () => { spentSol: number; buyCount: number; utcDate: string };
};

export function utcDateKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}

function freshDaily(): DailyLedger {
  return { utcDate: utcDateKey(), spentSol: 0, buyCount: 0 };
}

function normalizeDaily(daily: DailyLedger | undefined): DailyLedger {
  const today = utcDateKey();
  if (!daily || daily.utcDate !== today) return { utcDate: today, spentSol: 0, buyCount: 0 };
  return {
    utcDate: today,
    spentSol: Number.isFinite(daily.spentSol) ? Math.max(0, daily.spentSol) : 0,
    buyCount: Number.isFinite(daily.buyCount) ? Math.max(0, daily.buyCount) : 0,
  };
}

export const useAutoBuyStore = create<AutoBuyState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_AUTO_BUY_PREFS,
      daily: freshDaily(),
      setPrefs: (patch) => set((s) => ({ ...s, ...patch })),
      recordAutoBuySpend: (amountSol) => {
        if (!Number.isFinite(amountSol) || amountSol <= 0) return;
        set((s) => {
          const daily = normalizeDaily(s.daily);
          return {
            daily: {
              utcDate: daily.utcDate,
              spentSol: daily.spentSol + amountSol,
              buyCount: daily.buyCount + 1,
            },
          };
        });
      },
      getTodayStats: () => {
        const daily = normalizeDaily(get().daily);
        if (daily.utcDate !== get().daily.utcDate) {
          set({ daily });
        }
        return daily;
      },
    }),
    {
      name: 'pointer.auto-buy',
      partialize: (s) => ({
        autoBuyEnabled: s.autoBuyEnabled,
        defaultAutoBuySol: s.defaultAutoBuySol,
        autoBuyDailyCapSol: s.autoBuyDailyCapSol,
        autoBuyCooldownSec: s.autoBuyCooldownSec,
        daily: s.daily,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AutoBuyState>;
        return {
          ...current,
          ...DEFAULT_AUTO_BUY_PREFS,
          ...p,
          daily: normalizeDaily(p.daily as DailyLedger | undefined),
        };
      },
    },
  ),
);

export function selectAutoBuyMasterEnabled(s: AutoBuyPrefs): boolean {
  return s.autoBuyEnabled;
}
