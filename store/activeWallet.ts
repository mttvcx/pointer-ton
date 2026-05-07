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
    { name: 'pointer-active-wallet' },
  ),
);
