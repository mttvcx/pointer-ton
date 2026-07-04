'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Per-KOL (by wallet address) chart-bubble prefs. */
type KolPrefsState = {
  /** Hidden from chart bubbles (advanced charts not built yet — stored for later). */
  hiddenFromBubbles: Record<string, boolean>;
  /** Minimum buy (USD) for a KOL's trade to show as a bubble — filters penny-buy spam. */
  minBubbleUsd: Record<string, number>;
  toggleHidden: (address: string) => void;
  setMinBubble: (address: string, usd: number) => void;
};

export const useKolPrefsStore = create<KolPrefsState>()(
  persist(
    (set) => ({
      hiddenFromBubbles: {},
      minBubbleUsd: {},
      toggleHidden: (address) =>
        set((s) => ({ hiddenFromBubbles: { ...s.hiddenFromBubbles, [address]: !s.hiddenFromBubbles[address] } })),
      setMinBubble: (address, usd) =>
        set((s) => ({ minBubbleUsd: { ...s.minBubbleUsd, [address]: usd > 0 ? usd : 0 } })),
    }),
    { name: 'pointer.kol-prefs' },
  ),
);
