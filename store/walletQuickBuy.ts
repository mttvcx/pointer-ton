'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Shared quick-buy SOL amount for the wallet-tracker trades feed (toolbar pill + row ⚡). */
type WalletQuickBuyState = {
  amountSol: number;
  setAmount: (n: number) => void;
};

export const useWalletQuickBuyStore = create<WalletQuickBuyState>()(
  persist(
    (set) => ({
      amountSol: 0.5,
      setAmount: (amountSol) => set({ amountSol: amountSol > 0 ? amountSol : 0.5 }),
    }),
    { name: 'pointer.wallet-quickbuy' },
  ),
);
