'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ShareBackgroundPresetId } from '@/lib/share/types';
import { DEFAULT_BACKGROUND_ID } from '@/lib/share/backgrounds';
import {
  DEFAULT_PNL_BACKGROUND_TRANSFORM,
  PNL_TRACKER_BG_MAX_BYTES,
  type PnlBackgroundTransform,
} from '@/lib/pnl/backgroundTransform';
import { idbDeleteBlob, idbGetBlob, idbPutBlob } from '@/lib/share/localMediaDb';
import { IDB_PNL_TRACKER_BG_KEY } from '@/lib/share/sharePersistenceKeys';
import { readLayoutChromePx } from '@/lib/layout/dockPeekSnap';

export const DEFAULT_PNL_TRACKER_SIZE = { width: 320, height: 96 } as const;

export const PNL_TRACKER_SIZE_LIMITS = {
  minW: 180,
  maxW: 640,
  minH: 64,
  maxH: 240,
} as const;

export type PnlTrackerPrefs = {
  /** Show PNL in USD when false uses SOL for PNL column */
  swapUsdAndSol: boolean;
  showAltCurrency: boolean;
  backgroundId: ShareBackgroundPresetId;
  backgroundTransform: PnlBackgroundTransform;
  blurPx: number;
  opacityPct: number;
};

export const DEFAULT_PNL_TRACKER_PREFS: PnlTrackerPrefs = {
  swapUsdAndSol: false,
  showAltCurrency: false,
  backgroundId: DEFAULT_BACKGROUND_ID,
  backgroundTransform: { ...DEFAULT_PNL_BACKGROUND_TRANSFORM },
  blurPx: 0,
  opacityPct: 100,
};

export type PnlTrackerPortfolioScope = {
  /** `null` = All Wallets (combined / default portfolio API scope) */
  walletAddress: string | null;
  label: string;
};

type PnlTrackerState = {
  open: boolean;
  settingsOpen: boolean;
  position: { x: number; y: number };
  size: { width: number; height: number };
  prefs: PnlTrackerPrefs;
  /** When set, floating PNL reflects Portfolio wallet selector (not dock active wallet). */
  portfolioScope: PnlTrackerPortfolioScope | null;
  /** Runtime blob URL — loaded from IndexedDB, not persisted in localStorage */
  customBackgroundObjectUrl: string | null;
  customBackgroundHydrated: boolean;
  setOpen: (open: boolean) => void;
  toggleOpen: () => void;
  setSettingsOpen: (open: boolean) => void;
  setPosition: (p: { x: number; y: number }) => void;
  setSize: (s: { width: number; height: number }) => void;
  setPrefs: (patch: Partial<PnlTrackerPrefs>) => void;
  resetPrefs: () => void;
  setPortfolioScope: (scope: PnlTrackerPortfolioScope | null) => void;
  openFromPortfolio: (scope: PnlTrackerPortfolioScope) => void;
  hydrateCustomBackground: () => Promise<void>;
  setCustomBackgroundFromFile: (file: File) => Promise<void>;
  clearCustomBackground: () => Promise<void>;
};

const DEFAULT_POS = { x: 0, y: 0 };

function revokeIfBlob(url: string | null) {
  if (url?.startsWith('blob:')) URL.revokeObjectURL(url);
}

export const usePnlTrackerStore = create<PnlTrackerState>()(
  persist(
    (set, get) => ({
      open: false,
      settingsOpen: false,
      position: DEFAULT_POS,
      size: { ...DEFAULT_PNL_TRACKER_SIZE },
      prefs: { ...DEFAULT_PNL_TRACKER_PREFS },
      portfolioScope: null,
      customBackgroundObjectUrl: null,
      customBackgroundHydrated: false,
      setOpen: (open) => set({ open }),
      toggleOpen: () => {
        const next = !get().open;
        if (next) set({ open: true, portfolioScope: null });
        else set({ open: false });
      },
      setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
      setPosition: (position) => set({ position }),
      setSize: (size) => set({ size }),
      setPrefs: (patch) => set((s) => ({ prefs: { ...s.prefs, ...patch } })),
      setPortfolioScope: (portfolioScope) => set({ portfolioScope }),
      openFromPortfolio: (portfolioScope) => set({ open: true, portfolioScope }),
      resetPrefs: () => {
        revokeIfBlob(get().customBackgroundObjectUrl);
        void idbDeleteBlob(IDB_PNL_TRACKER_BG_KEY).catch(() => {});
        set({
          prefs: { ...DEFAULT_PNL_TRACKER_PREFS },
          customBackgroundObjectUrl: null,
        });
      },
      hydrateCustomBackground: async () => {
        if (get().customBackgroundHydrated) return;
        try {
          const buf = await idbGetBlob(IDB_PNL_TRACKER_BG_KEY);
          if (buf) {
            const blob = new Blob([buf], { type: 'image/jpeg' });
            const url = URL.createObjectURL(blob);
            set({ customBackgroundObjectUrl: url, customBackgroundHydrated: true });
            return;
          }
        } catch {
          /* ignore IDB read failures */
        }
        set({ customBackgroundHydrated: true });
      },
      setCustomBackgroundFromFile: async (file: File) => {
        if (file.size > PNL_TRACKER_BG_MAX_BYTES) {
          throw new Error(`Image too large (max ${Math.round(PNL_TRACKER_BG_MAX_BYTES / 1024)}KB)`);
        }
        const buf = await file.arrayBuffer();
        await idbPutBlob(IDB_PNL_TRACKER_BG_KEY, buf);
        const blob = new Blob([buf], { type: file.type || 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        revokeIfBlob(get().customBackgroundObjectUrl);
        set({
          customBackgroundObjectUrl: url,
          customBackgroundHydrated: true,
          prefs: {
            ...get().prefs,
            backgroundTransform: { ...DEFAULT_PNL_BACKGROUND_TRANSFORM },
          },
        });
      },
      clearCustomBackground: async () => {
        await idbDeleteBlob(IDB_PNL_TRACKER_BG_KEY).catch(() => {});
        revokeIfBlob(get().customBackgroundObjectUrl);
        set({
          customBackgroundObjectUrl: null,
          prefs: {
            ...get().prefs,
            backgroundTransform: { ...DEFAULT_PNL_BACKGROUND_TRANSFORM },
          },
        });
      },
    }),
    {
      name: 'pointer-pnl-tracker',
      partialize: (s) => ({
        open: s.open,
        position: s.position,
        size: s.size,
        prefs: s.prefs,
      }),
      version: 3,
      migrate: (persisted: unknown, version: number) => {
        if (!persisted || typeof persisted !== 'object') return persisted;
        const p = persisted as Record<string, unknown>;
        const prefsRaw = p.prefs;
        let next = persisted;
        if (prefsRaw && typeof prefsRaw === 'object') {
          const prefsObj = prefsRaw as Partial<PnlTrackerPrefs> & { customBackgroundUrl?: string | null };
          const { customBackgroundUrl: _removed, ...rest } = prefsObj;
          next = {
            ...p,
            prefs: {
              ...DEFAULT_PNL_TRACKER_PREFS,
              ...rest,
              backgroundTransform: rest.backgroundTransform ?? { ...DEFAULT_PNL_BACKGROUND_TRANSFORM },
            },
          };
        }
        if (version < 3) {
          next = { ...(next as Record<string, unknown>), size: { ...DEFAULT_PNL_TRACKER_SIZE } };
        }
        return next;
      },
    },
  ),
);

/** Resolve initial anchor once viewport is known. */
export function defaultPnlTrackerPosition(
  vw: number,
  topbar: number,
  size: { width: number; height: number } = DEFAULT_PNL_TRACKER_SIZE,
): { x: number; y: number } {
  return {
    x: Math.round(Math.max(12, (vw - size.width) / 2)),
    y: Math.round(topbar + 72),
  };
}

export function clampPnlTrackerSize(width: number, height: number): { width: number; height: number } {
  const { minW, maxW, minH, maxH } = PNL_TRACKER_SIZE_LIMITS;
  return {
    width: Math.round(Math.min(maxW, Math.max(minW, width))),
    height: Math.round(Math.min(maxH, Math.max(minH, height))),
  };
}

/** Keep at least `peekPx` of the widget visible when dragged off-screen. */
export function clampPnlTrackerPosition(
  x: number,
  y: number,
  size: { width: number; height: number },
  peekPx = 20,
): { x: number; y: number } {
  const { botbar } = readLayoutChromePx();
  const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
  const minX = -size.width + peekPx;
  const maxX = vw - peekPx;
  const minY = -size.height + peekPx;
  const maxY = vh - botbar - peekPx;
  return {
    x: Math.round(Math.min(maxX, Math.max(minX, x))),
    y: Math.round(Math.min(maxY, Math.max(minY, y))),
  };
}
