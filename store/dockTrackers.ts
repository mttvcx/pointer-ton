'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DOCK_TRACKER_IDS,
  type DockTrackerId,
  type DockTrackerMode,
} from '@/lib/dock/dockTrackerConfig';

export type DockSpotTickerMode = 'full' | 'icons';

const DEFAULT_ORDER = [...DOCK_TRACKER_IDS];

const DEFAULT_MODES: Record<DockTrackerId, DockTrackerMode> = {
  wallet: 'compact',
  social: 'compact',
  discover: 'compact',
  pulse: 'compact',
  pnl: 'compact',
  alpha: 'compact',
  squads: 'compact',
};

/** Notification dot (Axiom-style) — user-togglable later; defaults match reference. */
const DEFAULT_BADGE: Record<DockTrackerId, boolean> = {
  wallet: true,
  social: true,
  discover: true,
  pulse: true,
  pnl: false,
  alpha: false,
  squads: false,
};

function normalizeOrder(order: DockTrackerId[] | undefined): DockTrackerId[] {
  const base = order?.length ? [...order] : [...DEFAULT_ORDER];
  const set = new Set(base);
  for (const id of DOCK_TRACKER_IDS) {
    if (!set.has(id)) base.push(id);
  }
  return base.filter((id, i) => DOCK_TRACKER_IDS.includes(id) && base.indexOf(id) === i);
}

/** Merge persisted partials so every tracker has Full / Compact / Icon (not only ids in storage). */
export function normalizeDockModes(
  modes: Partial<Record<DockTrackerId, DockTrackerMode>> | undefined,
): Record<DockTrackerId, DockTrackerMode> {
  return { ...DEFAULT_MODES, ...modes };
}

interface DockTrackersState {
  order: DockTrackerId[];
  modes: Record<DockTrackerId, DockTrackerMode>;
  badges: Record<DockTrackerId, boolean>;
  hotkeysEnabled: boolean;
  /** Single character or key like "F2" after capture */
  hotkeys: Partial<Record<DockTrackerId, string | null>>;
  settingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;
  setOrder: (order: DockTrackerId[]) => void;
  moveItem: (from: number, to: number) => void;
  setMode: (id: DockTrackerId, mode: DockTrackerMode) => void;
  /** Applies one display mode to every dock chip at once (Full / Compact / Icon). */
  setAllModes: (mode: DockTrackerMode) => void;
  setBadge: (id: DockTrackerId, on: boolean) => void;
  setHotkeysEnabled: (on: boolean) => void;
  setHotkey: (id: DockTrackerId, key: string | null) => void;
  resetDock: () => void;
  spotTickerMode: DockSpotTickerMode;
  setSpotTickerMode: (m: DockSpotTickerMode) => void;
}

export const useDockTrackersStore = create<DockTrackersState>()(
  persist(
    (set, get) => ({
      order: [...DEFAULT_ORDER],
      modes: { ...DEFAULT_MODES },
      badges: { ...DEFAULT_BADGE },
      hotkeysEnabled: true,
      hotkeys: {},
      settingsOpen: false,
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      setOrder: (order) => set({ order: normalizeOrder(order) }),
      moveItem: (from, to) => {
        const o = normalizeOrder([...get().order]);
        if (from < 0 || from >= o.length || to < 0 || to >= o.length) return;
        if (from === to) return;
        const [item] = o.splice(from, 1);
        if (!item) return;
        const insertAt = from < to ? to - 1 : to;
        o.splice(insertAt, 0, item);
        set({ order: normalizeOrder(o) });
      },
      setMode: (id, mode) =>
        set((s) => ({ modes: { ...s.modes, [id]: mode } })),
      setAllModes: (mode) =>
        set({
          modes: Object.fromEntries(
            DOCK_TRACKER_IDS.map((id) => [id, mode]),
          ) as Record<DockTrackerId, DockTrackerMode>,
        }),
      setBadge: (id, on) =>
        set((s) => ({ badges: { ...s.badges, [id]: on } })),
      setHotkeysEnabled: (on) => set({ hotkeysEnabled: on }),
      setHotkey: (id, key) =>
        set((s) => ({
          hotkeys: { ...s.hotkeys, [id]: key },
        })),
      spotTickerMode: 'full',
      setSpotTickerMode: (spotTickerMode) => set({ spotTickerMode }),
      resetDock: () =>
        set({
          order: [...DEFAULT_ORDER],
          modes: { ...DEFAULT_MODES },
          badges: { ...DEFAULT_BADGE },
          hotkeysEnabled: true,
          hotkeys: {},
          spotTickerMode: 'full',
        }),
    }),
    {
      name: 'pointer-dock-trackers',
      partialize: (s) => ({
        order: s.order,
        modes: s.modes,
        badges: s.badges,
        hotkeysEnabled: s.hotkeysEnabled,
        hotkeys: s.hotkeys,
        spotTickerMode: s.spotTickerMode,
      }),
    },
  ),
);

export function normalizeDockOrder(order: DockTrackerId[] | undefined): DockTrackerId[] {
  return normalizeOrder(order);
}
