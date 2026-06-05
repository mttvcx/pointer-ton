'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  TOPBAR_NAV_DEFAULT_ORDER,
  normalizeTopbarNavOrder,
  type TopbarNavId,
} from '@/lib/layout/topbarNav';

interface TopbarNavState {
  order: TopbarNavId[];
  setOrder: (order: TopbarNavId[]) => void;
  moveItem: (from: number, to: number) => void;
  resetOrder: () => void;
}

export const useTopbarNavStore = create<TopbarNavState>()(
  persist(
    (set, get) => ({
      order: [...TOPBAR_NAV_DEFAULT_ORDER],
      setOrder: (order) => set({ order: normalizeTopbarNavOrder(order) }),
      moveItem: (from, to) => {
        const o = normalizeTopbarNavOrder([...get().order]);
        if (from < 0 || from >= o.length || to < 0 || to >= o.length) return;
        if (from === to) return;
        const [item] = o.splice(from, 1);
        if (!item) return;
        const insertAt = from < to ? to - 1 : to;
        o.splice(insertAt, 0, item);
        set({ order: normalizeTopbarNavOrder(o) });
      },
      resetOrder: () => set({ order: [...TOPBAR_NAV_DEFAULT_ORDER] }),
    }),
    { name: 'pointer.topbar-nav.v1' },
  ),
);

export { normalizeTopbarNavOrder };
