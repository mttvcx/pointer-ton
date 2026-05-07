'use client';

import { create } from 'zustand';

export type WalletLabelResolved = {
  walletAddress: string;
  label: string;
  emoji: string | null;
  color: string;
};

type WalletLabelsState = {
  byAddress: Record<string, WalletLabelResolved>;
  pendingModalAddress: string | null;
  setPendingModalAddress: (address: string | null) => void;
  hydrateFromApi: (labels: WalletLabelResolved[]) => void;
  upsertLocal: (row: WalletLabelResolved) => void;
  removeLocal: (walletAddress: string) => void;
  reset: () => void;
};

export const useWalletLabelsStore = create<WalletLabelsState>((set) => ({
  byAddress: {},
  pendingModalAddress: null,

  setPendingModalAddress: (address) => set({ pendingModalAddress: address }),

  hydrateFromApi: (labels) =>
    set({
      byAddress: Object.fromEntries(labels.map((l) => [l.walletAddress, l])),
    }),

  upsertLocal: (row) =>
    set((s) => ({
      byAddress: { ...s.byAddress, [row.walletAddress]: row },
    })),

  removeLocal: (walletAddress) =>
    set((s) => {
      const next = { ...s.byAddress };
      delete next[walletAddress];
      return { byAddress: next };
    }),

  reset: () => set({ byAddress: {}, pendingModalAddress: null }),
}));
