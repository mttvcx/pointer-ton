'use client';

import { create } from 'zustand';

/** Client-side demo toggle for the wallet-tracker trades feed (test UI w/o live data). */
type WalletTrackerPreviewState = {
  preview: boolean;
  setPreview: (v: boolean) => void;
  toggle: () => void;
};

export const useWalletTrackerPreviewStore = create<WalletTrackerPreviewState>((set) => ({
  preview: false,
  setPreview: (preview) => set({ preview }),
  toggle: () => set((s) => ({ preview: !s.preview })),
}));
