'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type RecentTokenVisit = {
  mint: string;
  symbol: string | null;
  name: string | null;
  imageUrl: string | null;
  marketCapUsd: number | null;
  visitedAt: number;
};

const MAX = 16;

type RecentTokenVisitsState = {
  visits: RecentTokenVisit[];
  noteVisit: (input: Omit<RecentTokenVisit, 'visitedAt'>) => void;
  clearVisits: () => void;
};

export const useRecentTokenVisitsStore = create<RecentTokenVisitsState>()(
  persist(
    (set, get) => ({
      visits: [],
      noteVisit: (input) => {
        const mint = input.mint?.trim() ?? '';
        if (mint.length < 32) return;
        const row: RecentTokenVisit = {
          mint,
          symbol: input.symbol?.trim() || null,
          name: input.name?.trim() || null,
          imageUrl: input.imageUrl ?? null,
          marketCapUsd:
            input.marketCapUsd != null && Number.isFinite(input.marketCapUsd)
              ? input.marketCapUsd
              : null,
          visitedAt: Date.now(),
        };
        const next = [row, ...get().visits.filter((v) => v.mint !== mint)].slice(0, MAX);
        set({ visits: next });
      },
      clearVisits: () => set({ visits: [] }),
    }),
    {
      name: 'pointer-recent-token-visits',
      partialize: (s) => ({ visits: s.visits }),
    },
  ),
);

/** Record a token desk visit without subscribing (token header mount). */
export function noteRecentTokenVisit(input: Omit<RecentTokenVisit, 'visitedAt'>): void {
  useRecentTokenVisitsStore.getState().noteVisit(input);
}
