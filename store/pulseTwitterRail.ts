'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type PulseTwitterRailSide = 'hidden' | 'left' | 'right';

type PulseTwitterRailState = {
  side: PulseTwitterRailSide;
  cycleSide: () => void;
  setSide: (side: PulseTwitterRailSide) => void;
};

function nextSide(side: PulseTwitterRailSide): PulseTwitterRailSide {
  if (side === 'hidden') return 'left';
  if (side === 'left') return 'right';
  return 'hidden';
}

export const usePulseTwitterRailStore = create<PulseTwitterRailState>()(
  persist(
    (set, get) => ({
      side: 'hidden',
      setSide: (side) => set({ side }),
      cycleSide: () => set({ side: nextSide(get().side) }),
    }),
    {
      name: 'pointer-pulse-twitter-rail',
      version: 1,
      merge: (persisted, current) => {
        const p = persisted as Partial<PulseTwitterRailState> | undefined;
        const side = p?.side;
        return {
          ...current,
          side:
            side === 'left' || side === 'right' || side === 'hidden' ? side : 'hidden',
        };
      },
      migrate: (persisted, version) => {
        const state = persisted as { side?: PulseTwitterRailSide } | undefined;
        if (version === 0) {
          return { side: (state?.side ?? 'hidden') as PulseTwitterRailSide };
        }
        return (state ?? { side: 'hidden' }) as Pick<PulseTwitterRailState, 'side'>;
      },
      partialize: (s) => ({ side: s.side }),
    },
  ),
);
