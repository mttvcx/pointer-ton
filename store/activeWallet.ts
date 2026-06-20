'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ActiveWalletState {
  activeWalletAddress: string | null;
  /** True only when the user explicitly chose this wallet (vs the hook auto-selecting). */
  manuallyPicked: boolean;
  setActiveWalletAddress: (addr: string | null, manual?: boolean) => void;
}

export const useActiveWalletStore = create<ActiveWalletState>()(
  persist(
    (set) => ({
      activeWalletAddress: null,
      manuallyPicked: false,
      setActiveWalletAddress: (addr, manual = false) =>
        set({ activeWalletAddress: addr, manuallyPicked: Boolean(manual) && addr != null }),
    }),
    /** TON app build: isolates from any legacy Solana-localStorage wallet selection. */
    { name: 'pointer-active-wallet-ton' },
  ),
);
