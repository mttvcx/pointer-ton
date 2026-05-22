'use client';

import { create } from 'zustand';
import type { CalendarTradeInput, ClosedSellPnlInput } from '@/lib/portfolio/dailyPnlCalendar';

export type { MonthlyPnlSharePayload } from '@/lib/portfolio/monthlyPnlSharePayload';

export type PnlCalendarOpenPayload = {
  closedSells: ClosedSellPnlInput[];
  trades: CalendarTradeInput[];
  solUsd: number | null;
  usdMode?: boolean;
};

type PnlCalendarState = PnlCalendarOpenPayload & {
  open: boolean;
  openCalendar: (payload: PnlCalendarOpenPayload) => void;
  close: () => void;
};

const EMPTY: PnlCalendarOpenPayload = {
  closedSells: [],
  trades: [],
  solUsd: null,
  usdMode: true,
};

export const usePnlCalendarStore = create<PnlCalendarState>((set) => ({
  open: false,
  ...EMPTY,
  openCalendar: (payload) => set({ open: true, ...payload }),
  close: () => set({ open: false }),
}));
