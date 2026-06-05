'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

type WalletTrackerMuteState = {
  /** Tracked wallet keys (label or address) with pings suppressed. */
  muted: Record<string, true>;
  toggleMuted: (walletKey: string) => void;
  isMuted: (walletKey: string) => boolean;
};

function norm(key: string) {
  return key.trim().toLowerCase();
}

export const useWalletTrackerMuteStore = create<WalletTrackerMuteState>()(
  persist(
    (set, get) => ({
      muted: {},
      toggleMuted: (walletKey) => {
        const k = norm(walletKey);
        if (!k) return;
        set((s) => {
          const next = { ...s.muted };
          if (next[k]) delete next[k];
          else next[k] = true;
          return { muted: next };
        });
      },
      isMuted: (walletKey) => Boolean(get().muted[norm(walletKey)]),
    }),
    { name: 'pointer.wallet-tracker-mute', partialize: (s) => ({ muted: s.muted }) },
  ),
);
