'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type State = {
  broadcast: boolean;
  statement: string;
  preferredChains: string[];
  strategyTags: string[];
  setBroadcast: (v: boolean) => void;
  setStatement: (s: string) => void;
  addChain: (c: string) => void;
  addTag: (t: string) => void;
};

export const useSquadsLfsStore = create<State>()(
  persist(
    (set, get) => ({
      broadcast: true,
      statement:
        'Flow trader with tight risk controls and fast execution. Open to mission-aligned squads.',
      preferredChains: ['Solana', 'TON', 'Base'],
      strategyTags: ['Flow trading', 'Momentum', 'Liquidations'],
      setBroadcast: (v) => set({ broadcast: v }),
      setStatement: (s) => set({ statement: s }),
      addChain: (c) => {
        const x = get().preferredChains;
        if (x.includes(c)) return;
        set({ preferredChains: [...x, c] });
      },
      addTag: (t) => {
        const x = get().strategyTags;
        if (x.includes(t)) return;
        set({ strategyTags: [...x, t] });
      },
    }),
    { name: 'pointer-squads-lfs-v1' },
  ),
);
