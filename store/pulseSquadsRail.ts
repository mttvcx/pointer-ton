'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PulseSquadsRailSide = 'hidden' | 'right';

type PulseSquadsRailState = {
  side: PulseSquadsRailSide;
  setSide: (side: PulseSquadsRailSide) => void;
  toggle: () => void;
};

export const usePulseSquadsRailStore = create<PulseSquadsRailState>()(
  persist(
    (set, get) => ({
      side: 'hidden',
      setSide: (side) => set({ side }),
      toggle: () =>
        set({ side: get().side === 'hidden' ? 'right' : 'hidden' }),
    }),
    {
      name: 'pointer-pulse-squads-rail',
      version: 1,
      merge: (persisted, current) => {
        const p = persisted as Partial<PulseSquadsRailState> | undefined;
        const side = p?.side;
        return {
          ...current,
          side: side === 'right' ? 'right' : 'hidden',
        };
      },
      partialize: (s) => ({ side: s.side }),
    },
  ),
);
