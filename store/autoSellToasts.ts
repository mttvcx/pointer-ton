'use client';

import { create } from 'zustand';

export type AutoSellToastStatus = 'pending' | 'success' | 'failed' | 'skipped';

export type AutoSellToastItem = {
  id: string;
  status: AutoSellToastStatus;
  title: string;
  subtitle?: string;
  mint?: string;
  txSignature?: string | null;
  error?: string;
  createdAt: number;
};

type AutoSellToastState = {
  items: AutoSellToastItem[];
  push: (item: Omit<AutoSellToastItem, 'id' | 'createdAt'> & { id?: string }) => string;
  patch: (id: string, patch: Partial<AutoSellToastItem>) => void;
  dismiss: (id: string) => void;
};

let toastSeq = 0;

export const useAutoSellToastStore = create<AutoSellToastState>((set) => ({
  items: [],
  push: (item) => {
    const id = item.id ?? `as-toast-${++toastSeq}`;
    const row: AutoSellToastItem = {
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
