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
  width: 520,
  height: 620,
};
/** First open anchor; after that position is persisted while dragging. */
const DEFAULT_WALLET_POS = { x: 16, y: 360 };
/** Wallet / trades peek — roomy default so sparse rows never shrink chrome */
export const DEFAULT_WALLET_TRACKER_PEEK_SIZE: PulsePeekPanelSize = {
  width: 440,
  height: 480,
};
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
    },
  ),
);
