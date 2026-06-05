'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_PULSE_DISPLAY_PREFS,
  type PulseDisplayPrefs,
  pickPulseDisplayPrefs,
  withPulseDisplayDefaults,
} from '@/lib/preferences/pulseDisplay';
import { usePulseColumnStore } from '@/store/pulseColumns';
import type { PulseColumnId } from '@/lib/utils/constants';

type PulseDisplayState = PulseDisplayPrefs & {
  setPrefs: (patch: Partial<PulseDisplayPrefs>) => void;
  resetPrefs: () => void;
};

const COLUMN_IDS: PulseColumnId[] = ['new', 'stretch', 'migrated'];

function syncPulseDisplaySideEffects(prefs: PulseDisplayPrefs) {
  const col = usePulseColumnStore.getState();
  col.setBuyButtonStyleAll(prefs.quickBuyButtonSize);
  for (const id of COLUMN_IDS) {
    col.setQuickBuySol(id, prefs.displayQuickBuySol);
  }

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.setAttribute('data-pulse-mc-metric', prefs.mcMetricSize);
    root.setAttribute('data-pulse-circle-avatars', String(prefs.circleAvatars));
    root.setAttribute('data-pulse-no-decimals', String(prefs.noDecimals));
    root.setAttribute('data-pulse-color-row', String(prefs.colorRowByProtocol));
    root.setAttribute('data-pulse-accent', prefs.accentHex);
  }
}

export const usePulseDisplayPrefsStore = create<PulseDisplayState>()(
  persist(
    (set) => ({
      ...DEFAULT_PULSE_DISPLAY_PREFS,
      setPrefs: (patch) =>
        set((s) => {
          const next = withPulseDisplayDefaults({ ...pickPulseDisplayPrefs(s), ...patch });
          syncPulseDisplaySideEffects(next);
          return { ...s, ...next };
        }),
      resetPrefs: () => {
        syncPulseDisplaySideEffects(DEFAULT_PULSE_DISPLAY_PREFS);
        set((s) => ({ ...s, ...DEFAULT_PULSE_DISPLAY_PREFS }));
      },
    }),
    {
      name: 'pointer.pulse-display',
      version: 2,
      partialize: (s) => pickPulseDisplayPrefs(s),
      migrate: (persisted, fromVersion) => {
        if (fromVersion < 2) {
          return withPulseDisplayDefaults(persisted as Partial<PulseDisplayPrefs> | undefined);
        }
        return persisted as PulseDisplayPrefs;
      },
      merge: (persisted, current) => ({
        ...current,
        ...withPulseDisplayDefaults(persisted as Partial<PulseDisplayPrefs> | undefined),
      }),
      onRehydrateStorage: () => (state) => {
        if (state) syncPulseDisplaySideEffects(pickPulseDisplayPrefs(state));
      },
    },
  ),
);
