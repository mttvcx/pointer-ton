'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AutoLaunchMode = 'manual' | 'ai';

export type AutoLaunchPrefs = {
  autoLaunchEnabled: boolean;
  launchMode: AutoLaunchMode;
  /** Dev / sniper buy at deploy (manual path). */
  launchBuySol: number;
  /** Manual: default token name when tweet has no clear name. */
  manualNameTemplate: string;
  manualSymbolTemplate: string;
  useTweetImageAsLogo: boolean;
  /** AI path — tone hint for future agent. */
  aiStyle: 'meme' | 'balanced' | 'serious';
};

export const DEFAULT_AUTO_LAUNCH_PREFS: AutoLaunchPrefs = {
  autoLaunchEnabled: false,
  launchMode: 'ai',
  launchBuySol: 0.5,
  manualNameTemplate: '{tweet_keyword}',
  manualSymbolTemplate: '{keyword}',
  useTweetImageAsLogo: true,
  aiStyle: 'meme',
};

type AutoLaunchState = AutoLaunchPrefs & {
  setPrefs: (patch: Partial<AutoLaunchPrefs>) => void;
};

export const useAutoLaunchStore = create<AutoLaunchState>()(
  persist(
    (set) => ({
      ...DEFAULT_AUTO_LAUNCH_PREFS,
      setPrefs: (patch) => set((s) => ({ ...s, ...patch })),
    }),
    { name: 'pointer.auto-launch' },
  ),
);
