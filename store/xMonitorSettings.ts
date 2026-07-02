'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Where the vertical launch rail sits on each feed card. */
export type LaunchRailSide = 'left' | 'right';
/** Fill (accent background) vs outline (border only) — matches quick-buy vs bordered. */
export type LaunchRailStyle = 'fill' | 'outline';
/** Deploy surface: full modal (default) or a docked side panel. */
export type DeployMode = 'modal' | 'sidePanel';

/** Feed source channels the operator can toggle on/off. */
export type FeedSource = 'x' | 'instagram' | 'truth' | 'caTracker' | 'news' | 'affiliates';

export type XMonitorSettings = {
  /** Launch rail appearance / placement. */
  launchRailSide: LaunchRailSide;
  launchRailStyle: LaunchRailStyle;
  /** null = use theme accent. Hex like #7c5cff otherwise. */
  launchRailColor: string | null;

  /** Deploy opens a modal or a docked side panel. */
  deployMode: DeployMode;

  /** Which upstream channels feed the monitor. */
  sources: Record<FeedSource, boolean>;

  /** Highlight tweets that contain any of these words (case-insensitive). */
  keywordHighlights: string[];
  /** Auto-suppress tweets containing any of these (mutes). */
  mutedKeywords: string[];
  /** Only ever surface these handles (empty = all tracked). */
  whitelistHandles: string[];

  /** AI suggestion engine controls. */
  aiSuggestionsEnabled: boolean;
  aiSuggestionCount: number;

  /** Quick-buy presets shown on cards (SOL). */
  buyPresets: number[];

  /** Keyboard shortcuts (single keys). */
  keybinds: {
    quickBuy: string;
    deploy: string;
    dismiss: string;
  };
};

export const DEFAULT_XMONITOR_SETTINGS: XMonitorSettings = {
  launchRailSide: 'left',
  launchRailStyle: 'fill',
  launchRailColor: null,
  deployMode: 'modal',
  sources: {
    x: true,
    instagram: true,
    truth: true,
    caTracker: true,
    news: true,
    affiliates: true,
  },
  keywordHighlights: [],
  mutedKeywords: [],
  whitelistHandles: [],
  aiSuggestionsEnabled: true,
  aiSuggestionCount: 3,
  buyPresets: [0.5, 1, 2, 5],
  keybinds: {
    quickBuy: 'b',
    deploy: 'd',
    dismiss: 'x',
  },
};

type XMonitorSettingsState = XMonitorSettings & {
  set: (patch: Partial<XMonitorSettings>) => void;
  setSource: (source: FeedSource, on: boolean) => void;
  setKeybind: (action: keyof XMonitorSettings['keybinds'], key: string) => void;
  reset: () => void;
};

export const useXMonitorSettings = create<XMonitorSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_XMONITOR_SETTINGS,
      set: (patch) => set((s) => ({ ...s, ...patch })),
      setSource: (source, on) =>
        set((s) => ({ ...s, sources: { ...s.sources, [source]: on } })),
      setKeybind: (action, key) =>
        set((s) => ({ ...s, keybinds: { ...s.keybinds, [action]: key } })),
      reset: () => set((s) => ({ ...s, ...DEFAULT_XMONITOR_SETTINGS })),
    }),
    { name: 'pointer.x-monitor-settings' },
  ),
);
