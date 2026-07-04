'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/** Where the launch rail sits on each feed card. */
export type LaunchRailSide = 'left' | 'right' | 'top' | 'bottom';
/** Fill (accent background) vs outline (border only) — matches quick-buy vs bordered. */
export type LaunchRailStyle = 'fill' | 'outline';
/** Launch rail thickness. */
export type LaunchRailSize = 'default' | 'big';
/** Deploy surface: full modal (default) or a docked side panel. */
export type DeployMode = 'modal' | 'sidePanel';

/** Feed source channels the operator can toggle on/off. */
export type FeedSource = 'x' | 'instagram' | 'truth' | 'caTracker' | 'news' | 'affiliates' | 'discord';

export type XMonitorSettings = {
  /** Launch rail appearance / placement. */
  launchRailSide: LaunchRailSide;
  launchRailStyle: LaunchRailStyle;
  launchRailSize: LaunchRailSize;
  /** null = use theme accent. Hex like #7c5cff otherwise. */
  launchRailColor: string | null;

  /** Deploy opens a modal or a docked side panel. */
  deployMode: DeployMode;

  /** Which upstream channels feed the monitor. */
  sources: Record<FeedSource, boolean>;
  /** Per-source disabled entry ids (handle / wire / server). Absent = all on. */
  sourceExclusions: Partial<Record<FeedSource, string[]>>;

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

  /** Wallet that signs the deploy (address; null = prompt at deploy). */
  deployWallet: string | null;
  /** Base58 secret key for a pasted custom deploy wallet (needed to actually sign). */
  deployWalletKey: string | null;
  /** Extra wallets used for sniper / buy-in spread. */
  buyInWallets: Array<{ label: string; address: string }>;

  /** Priority-fee tier for buys/deploys (speed vs cost). */
  feePreset: 'low' | 'med' | 'high' | 'turbo';
  /** Jito tip (SOL) added to bundled txns for landing priority. */
  jitoTipSol: number;
};

/** SOL priority-fee amounts per tier (informational; consumed by tx builders). */
export const FEE_PRESET_SOL: Record<XMonitorSettings['feePreset'], number> = {
  low: 0.0005,
  med: 0.001,
  high: 0.005,
  turbo: 0.02,
};

export const DEFAULT_XMONITOR_SETTINGS: XMonitorSettings = {
  launchRailSide: 'left',
  launchRailStyle: 'fill',
  launchRailSize: 'default',
  launchRailColor: null,
  deployMode: 'modal',
  sources: {
    x: true,
    instagram: true,
    truth: true,
    caTracker: true,
    news: true,
    affiliates: true,
    discord: true,
  },
  sourceExclusions: {},
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
  deployWallet: null,
  deployWalletKey: null,
  buyInWallets: [],
  feePreset: 'med',
  jitoTipSol: 0.001,
};

type XMonitorSettingsState = XMonitorSettings & {
  set: (patch: Partial<XMonitorSettings>) => void;
  setSource: (source: FeedSource, on: boolean) => void;
  /** Toggle a single entry (handle/wire/server) within a source on/off. */
  toggleSourceEntry: (source: FeedSource, id: string, on: boolean) => void;
  /** Bulk set exclusions for a source (e.g. select-all / clear). */
  setSourceExclusions: (source: FeedSource, ids: string[]) => void;
  setKeybind: (action: keyof XMonitorSettings['keybinds'], key: string) => void;
  addBuyInWallet: (w: { label: string; address: string }) => void;
  removeBuyInWallet: (address: string) => void;
  reset: () => void;
};

export const useXMonitorSettings = create<XMonitorSettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_XMONITOR_SETTINGS,
      set: (patch) => set((s) => ({ ...s, ...patch })),
      setSource: (source, on) =>
        set((s) => ({ ...s, sources: { ...s.sources, [source]: on } })),
      toggleSourceEntry: (source, id, on) =>
        set((s) => {
          const cur = s.sourceExclusions[source] ?? [];
          const next = on ? cur.filter((x) => x !== id) : cur.includes(id) ? cur : [...cur, id];
          return { ...s, sourceExclusions: { ...s.sourceExclusions, [source]: next } };
        }),
      setSourceExclusions: (source, ids) =>
        set((s) => ({ ...s, sourceExclusions: { ...s.sourceExclusions, [source]: ids } })),
      setKeybind: (action, key) =>
        set((s) => ({ ...s, keybinds: { ...s.keybinds, [action]: key } })),
      addBuyInWallet: (w) =>
        set((s) =>
          s.buyInWallets.some((x) => x.address === w.address)
            ? s
            : { ...s, buyInWallets: [...s.buyInWallets, w] },
        ),
      removeBuyInWallet: (address) =>
        set((s) => ({ ...s, buyInWallets: s.buyInWallets.filter((x) => x.address !== address) })),
      reset: () => set((s) => ({ ...s, ...DEFAULT_XMONITOR_SETTINGS })),
    }),
    { name: 'pointer.x-monitor-settings' },
  ),
);
