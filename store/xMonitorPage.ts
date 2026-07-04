'use client';

import { create } from 'zustand';

/** Which X Monitor context "page" popup is open from the bottom strip. */
export type XMonitorPage = 'sell' | 'history' | 'rules' | 'settings' | null;

type XMonitorPageState = {
  page: XMonitorPage;
  setPage: (p: XMonitorPage) => void;
  toggle: (p: Exclude<XMonitorPage, null>) => void;
  close: () => void;
};

export const useXMonitorPageStore = create<XMonitorPageState>((set) => ({
  page: null,
  setPage: (page) => set({ page }),
  toggle: (p) => set((s) => ({ page: s.page === p ? null : p })),
  close: () => set({ page: null }),
}));
