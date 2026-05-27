'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  cloneHoldersTableSettings,
  DEFAULT_HOLDERS_TABLE_SETTINGS,
  type HoldersTableColumnId,
  type HoldersTableSettings,
} from '@/lib/tokens/holdersTableSettingsModel';

type HoldersTableSettingsState = {
  settings: HoldersTableSettings;
  setSettings: (next: HoldersTableSettings) => void;
  toggleColumn: (id: HoldersTableColumnId) => void;
  resetSettings: () => void;
};

export const useHoldersTableSettingsStore = create<HoldersTableSettingsState>()(
  persist(
    (set, get) => ({
      settings: cloneHoldersTableSettings(DEFAULT_HOLDERS_TABLE_SETTINGS),
      setSettings: (settings) => set({ settings: cloneHoldersTableSettings(settings) }),
      toggleColumn: (id) => {
        const s = get().settings;
        set({
          settings: {
            ...s,
            columns: { ...s.columns, [id]: !s.columns[id] },
          },
        });
      },
      resetSettings: () =>
        set({ settings: cloneHoldersTableSettings(DEFAULT_HOLDERS_TABLE_SETTINGS) }),
    }),
    {
      name: 'pointer-holders-table-settings',
      partialize: (s) => ({ settings: s.settings }),
    },
  ),
);
