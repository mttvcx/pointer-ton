'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ActiveWalletState {
  activeWalletAddress: string | null;
  setActiveWalletAddress: (addr: string | null) => void;
}

export const useActiveWalletStore = create<ActiveWalletState>()(
  persist(
    (set) => ({
      activeWalletAddress: null,
      setActiveWalletAddress: (addr) => set({ activeWalletAddress: addr }),
    }),
    /** TON app build: isolates from any legacy Solana-localStorage wallet selection. */
    { name: 'pointer-active-wallet-ton' },
  ),
);
