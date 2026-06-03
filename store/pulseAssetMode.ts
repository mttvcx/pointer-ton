'use client';

import { create } from 'zustand';

export type PulseAssetMode = 'memes' | 'stocks';

const STORAGE_KEY = 'pointer-pulse-asset-mode';

function readStored(): PulseAssetMode {
  if (typeof window === 'undefined') return 'memes';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY);
    if (v === 'stocks' || v === 'memes') return v;
  } catch {
    /* ignore */
  }
  return 'memes';
}

type State = {
  mode: PulseAssetMode;
  hydrated: boolean;
  setMode: (mode: PulseAssetMode) => void;
  hydrate: () => void;
};

export const usePulseAssetModeStore = create<State>((set) => ({
  mode: 'memes',
  hydrated: false,
  setMode: (mode) => {
    set({ mode });
    try {
      window.localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      /* ignore */
    }
  },
  hydrate: () => set({ mode: readStored(), hydrated: true }),
}));
