'use client';

import { create } from 'zustand';

export type AutoBuyToastStatus = 'pending' | 'success' | 'failed' | 'skipped';

export type AutoBuyToastItem = {
  id: string;
  status: AutoBuyToastStatus;
  title: string;
  subtitle?: string;
  mint?: string;
  txSignature?: string | null;
  error?: string;
  createdAt: number;
};

type AutoBuyToastState = {
  items: AutoBuyToastItem[];
  push: (item: Omit<AutoBuyToastItem, 'id' | 'createdAt'> & { id?: string }) => string;
  patch: (id: string, patch: Partial<AutoBuyToastItem>) => void;
  dismiss: (id: string) => void;
};

let toastSeq = 0;

export const useAutoBuyToastStore = create<AutoBuyToastState>((set) => ({
  items: [],
  push: (item) => {
    const id = item.id ?? `ab-toast-${++toastSeq}`;
    const row: AutoBuyToastItem = {
      id,
      createdAt: Date.now(),
      status: item.status,
      title: item.title,
      subtitle: item.subtitle,
      mint: item.mint,
      txSignature: item.txSignature,
      error: item.error,
    };
    set((s) => ({ items: [...s.items, row].slice(-6) }));
    return id;
  },
  patch: (id, patch) =>
    set((s) => ({
      items: s.items.map((t) => (t.id === id ? { ...t, ...patch } : t)),
    })),
  dismiss: (id) => set((s) => ({ items: s.items.filter((t) => t.id !== id) })),
}));
