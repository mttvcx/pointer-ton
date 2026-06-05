'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type SearchQuickBuySize = 'small' | 'large' | 'mega' | 'ultra';

/** `outline` = emerald border (Axiom Border Ultra). `filled` = solid emerald. `accent` = Pointer blue fill. */
export type SearchQuickBuyChrome = 'outline' | 'filled' | 'accent';

type SearchModalPrefsState = {
  quickBuySize: SearchQuickBuySize;
  quickBuyChrome: SearchQuickBuyChrome;
  quickBuyAmountSol: number;
  setQuickBuySize: (size: SearchQuickBuySize) => void;
  setQuickBuyChrome: (chrome: SearchQuickBuyChrome) => void;
  setQuickBuyAmountSol: (n: number) => void;
};

export const useSearchModalPrefsStore = create<SearchModalPrefsState>()(
  persist(
    (set) => ({
      quickBuySize: 'ultra',
      quickBuyChrome: 'outline',
      quickBuyAmountSol: 0.5,
      setQuickBuySize: (quickBuySize) => set({ quickBuySize }),
      setQuickBuyChrome: (quickBuyChrome) => set({ quickBuyChrome }),
      setQuickBuyAmountSol: (quickBuyAmountSol) => set({ quickBuyAmountSol }),
    }),
    { name: 'pointer-search-modal-prefs' },
  ),
);
