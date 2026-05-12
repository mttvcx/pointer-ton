'use client';

import { create } from 'zustand';
import type { DemoTrader } from '@/lib/squads/demo';

export type TraderDrawerOpen =
  | { mode: 'demo'; trader: DemoTrader }
  | { mode: 'live'; userId: string };

type State = {
  drawer: TraderDrawerOpen | null;
  openDemoTrader: (trader: DemoTrader) => void;
  openLiveTrader: (userId: string) => void;
  closeTrader: () => void;
};

export const useSquadsUiStore = create<State>((set) => ({
  drawer: null,
  openDemoTrader: (trader) => set({ drawer: { mode: 'demo', trader } }),
  openLiveTrader: (userId) => set({ drawer: { mode: 'live', userId } }),
  closeTrader: () => set({ drawer: null }),
}));
