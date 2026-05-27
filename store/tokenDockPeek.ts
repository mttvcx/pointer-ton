'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PulseColumnId } from '@/lib/utils/constants';

export type PeekDockSnapSide = null | 'left' | 'right';

/** @deprecated use PeekDockSnapSide */
export type PulseDockSnapSide = PeekDockSnapSide;

export type PulsePeekPanelSize = { width: number; height: number };

/** Global dock peek popups — Pulse + Tracker (wallet trades peek; non-modal backgrounds). */
type TokenDockPeekState = {
  pulsePeekOpen: boolean;
  setPulsePeekOpen: (open: boolean) => void;
  togglePulsePeek: () => void;
  dockPulseTab: PulseColumnId;
  setDockPulseTab: (tab: PulseColumnId) => void;
  dockPulsePosition: { x: number; y: number };
  setDockPulsePosition: (p: { x: number; y: number }) => void;
  dockPulseDockSnap: PeekDockSnapSide;
  setPulseDockSnap: (side: PeekDockSnapSide) => void;
  dockPulsePanelSize: PulsePeekPanelSize;
  setPulsePanelSize: (s: PulsePeekPanelSize) => void;
  walletPeekOpen: boolean;
  setWalletPeekOpen: (open: boolean) => void;
  toggleWalletPeek: () => void;
  dockWalletPosition: { x: number; y: number };
  setDockWalletPosition: (p: { x: number; y: number }) => void;
  dockWalletDockSnap: PeekDockSnapSide;
  setWalletDockSnap: (side: PeekDockSnapSide) => void;
  dockWalletPanelSize: PulsePeekPanelSize;
  setWalletPanelSize: (s: PulsePeekPanelSize) => void;
  xMonitorPeekOpen: boolean;
  setXMonitorPeekOpen: (open: boolean) => void;
  dockXMonitorPosition: { x: number; y: number };
  setDockXMonitorPosition: (p: { x: number; y: number }) => void;
  dockXMonitorDockSnap: PeekDockSnapSide;
  setXMonitorDockSnap: (side: PeekDockSnapSide) => void;
  dockXMonitorPanelSize: PulsePeekPanelSize;
  setXMonitorPanelSize: (s: PulsePeekPanelSize) => void;
};

const DEFAULT_TAB: PulseColumnId = 'new';
const DEFAULT_POS = { x: 14, y: 112 };
/** Comfortable default footprint — stays large even when a column has sparse rows */
export const DEFAULT_PULSE_PEEK_SIZE: PulsePeekPanelSize = {
  width: 380,
  height: 620,
};
/** First open anchor; after that position is persisted while dragging. */
const DEFAULT_WALLET_POS = { x: 16, y: 360 };
/** Wallet / trades peek — roomy default so sparse rows never shrink chrome */
export const DEFAULT_WALLET_TRACKER_PEEK_SIZE: PulsePeekPanelSize = {
  width: 380,
  height: 480,
};
/** Max dock peek width — matches embedded Pulse X-monitor rail (`PulsePageLayout`). */
export const DOCK_PEEK_MAX_PANEL_W = 420;

export function clampDockPeekWidth(width: number, minW = 320): number {
  const floor = Math.max(280, minW);
  if (typeof window === 'undefined') {
    return Math.min(DOCK_PEEK_MAX_PANEL_W, Math.max(floor, Math.round(width)));
  }
  const viewportCap = Math.max(floor, window.innerWidth - 24);
  return Math.min(DOCK_PEEK_MAX_PANEL_W, viewportCap, Math.max(floor, Math.round(width)));
}

export function clampDockPeekPanelSize(
  size: PulsePeekPanelSize,
  minW: number,
  minH: number,
): PulsePeekPanelSize {
  const floorW = Math.max(280, minW);
  let maxH = size.height;
  if (typeof window !== 'undefined') {
    const { topbar, botbar } = { topbar: 48, botbar: 40 };
    const vh = window.innerHeight;
    maxH = Math.max(minH, vh - topbar - botbar - 12);
  }
  return {
    width: clampDockPeekWidth(size.width, floorW),
    height: Math.round(Math.min(maxH, Math.max(minH, size.height))),
  };
}
/** X monitor float / edge dock */
export const DEFAULT_X_MONITOR_PEEK_SIZE: PulsePeekPanelSize = {
  width: 380,
  height: 640,
};
const DEFAULT_X_MONITOR_POS = { x: 12, y: 96 };

export const useTokenDockPeekStore = create<TokenDockPeekState>()(
  persist(
    (set, get) => ({
      pulsePeekOpen: false,
      setPulsePeekOpen: (open) => set({ pulsePeekOpen: open }),
      togglePulsePeek: () => set({ pulsePeekOpen: !get().pulsePeekOpen }),
      dockPulseTab: DEFAULT_TAB,
      setDockPulseTab: (dockPulseTab) => set({ dockPulseTab }),
      dockPulsePosition: DEFAULT_POS,
      setDockPulsePosition: (dockPulsePosition) => set({ dockPulsePosition }),
      dockPulseDockSnap: null,
      setPulseDockSnap: (dockPulseDockSnap) => set({ dockPulseDockSnap }),
      dockPulsePanelSize: { ...DEFAULT_PULSE_PEEK_SIZE },
      setPulsePanelSize: (dockPulsePanelSize) => set({ dockPulsePanelSize }),
      walletPeekOpen: false,
      setWalletPeekOpen: (open) => set({ walletPeekOpen: open }),
      toggleWalletPeek: () => set({ walletPeekOpen: !get().walletPeekOpen }),
      dockWalletPosition: DEFAULT_WALLET_POS,
      setDockWalletPosition: (dockWalletPosition) => set({ dockWalletPosition }),
      dockWalletDockSnap: null,
      setWalletDockSnap: (dockWalletDockSnap) => set({ dockWalletDockSnap }),
      dockWalletPanelSize: { ...DEFAULT_WALLET_TRACKER_PEEK_SIZE },
      setWalletPanelSize: (dockWalletPanelSize) => set({ dockWalletPanelSize }),
      xMonitorPeekOpen: false,
      setXMonitorPeekOpen: (open) => set({ xMonitorPeekOpen: open }),
      dockXMonitorPosition: DEFAULT_X_MONITOR_POS,
      setDockXMonitorPosition: (dockXMonitorPosition) => set({ dockXMonitorPosition }),
      dockXMonitorDockSnap: null,
      setXMonitorDockSnap: (dockXMonitorDockSnap) => set({ dockXMonitorDockSnap }),
      dockXMonitorPanelSize: { ...DEFAULT_X_MONITOR_PEEK_SIZE },
      setXMonitorPanelSize: (dockXMonitorPanelSize) => set({ dockXMonitorPanelSize }),
    }),
    {
      name: 'pointer-dock-pulse-panel',
      partialize: (s) => ({
        dockPulseTab: s.dockPulseTab,
        dockPulsePosition: s.dockPulsePosition,
        dockPulseDockSnap: s.dockPulseDockSnap,
        dockPulsePanelSize: s.dockPulsePanelSize,
        dockWalletPosition: s.dockWalletPosition,
        dockWalletDockSnap: s.dockWalletDockSnap,
        dockWalletPanelSize: s.dockWalletPanelSize,
        dockXMonitorPosition: s.dockXMonitorPosition,
        dockXMonitorDockSnap: s.dockXMonitorDockSnap,
        dockXMonitorPanelSize: s.dockXMonitorPanelSize,
      }),
      version: 2,
      migrate: (persisted: unknown) => {
        const p = persisted as Record<string, unknown> | undefined;
        if (!p || typeof p !== 'object') return persisted;
        const clampSize = (raw: unknown, fallback: PulsePeekPanelSize, minW: number, minH: number) => {
          if (!raw || typeof raw !== 'object') return fallback;
          const o = raw as Partial<PulsePeekPanelSize>;
          return clampDockPeekPanelSize(
            {
              width: typeof o.width === 'number' ? o.width : fallback.width,
              height: typeof o.height === 'number' ? o.height : fallback.height,
            },
            minW,
            minH,
          );
        };
        return {
          ...p,
          dockPulsePanelSize: clampSize(p.dockPulsePanelSize, DEFAULT_PULSE_PEEK_SIZE, 320, 360),
          dockWalletPanelSize: clampSize(
            p.dockWalletPanelSize,
            DEFAULT_WALLET_TRACKER_PEEK_SIZE,
            300,
            300,
          ),
          dockXMonitorPanelSize: clampSize(
            p.dockXMonitorPanelSize,
            DEFAULT_X_MONITOR_PEEK_SIZE,
            320,
            360,
          ),
        };
      },
    },
  ),
);
