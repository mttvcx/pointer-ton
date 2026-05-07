'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

const MAX = 8;

interface RecentTradeMintsState {
  mints: string[];
  noteMint: (mint: string) => void;
  clearRecents: () => void;
}

export const useRecentTradeMintsStore = create<RecentTradeMintsState>()(
  persist(
    (set, get) => ({
      mints: [],
      noteMint: (mint) => {
        const t = mint?.trim() ?? '';
        if (t.length < 32) return;
        const next = [t, ...get().mints.filter((m) => m !== t)].slice(0, MAX);
        set({ mints: next });
      },
      clearRecents: () => set({ mints: [] }),
    }),
    {
      name: 'pointer-recent-trade-mints',
      partialize: (s) => ({ mints: s.mints }),
    },
  ),
);

/** Fire-and-forget (e.g. token detail mount) without subscribing. */
export function noteRecentTradeMint(mint: string): void {
  useRecentTradeMintsStore.getState().noteMint(mint);
}
