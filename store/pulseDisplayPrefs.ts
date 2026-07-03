'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  DEFAULT_PULSE_DISPLAY_PREFS,
  type PulseDisplayPrefs,
  pickPulseDisplayPrefs,
  withPulseDisplayDefaults,
} from '@/lib/preferences/pulseDisplay';
import { applyPulseAccentToDocument } from '@/lib/ui/pulseAccent';
import { usePulseColumnStore } from '@/store/pulseColumns';
import type { PulseColumnId } from '@/lib/utils/constants';
import type { BuyButtonStyle } from '@/lib/tokens/columnPresetModel';

type PulseDisplayState = PulseDisplayPrefs & {
  setPrefs: (patch: Partial<PulseDisplayPrefs>) => void;
  resetPrefs: () => void;
  /** Mirror live column quick-buy into persisted display prefs (no column push). */
  hydrateQuickBuyFromColumns: () => void;
};

const COLUMN_IDS: PulseColumnId[] = ['new', 'stretch', 'migrated'];

export function getConsensusQuickBuyFromColumns(
  byColumn: Record<PulseColumnId, { quickBuySol: number; buyButtonStyle: BuyButtonStyle }>,
): { displayQuickBuySol: number; quickBuyButtonSize: BuyButtonStyle } {
  const solValues = COLUMN_IDS.map((id) => byColumn[id]?.quickBuySol ?? 0.5);
  const styleValues = COLUMN_IDS.map((id) => byColumn[id]?.buyButtonStyle ?? 'medium');
  const displayQuickBuySol = solValues.every((v) => v === solValues[0])
    ? (solValues[0] ?? 0.5)
    : (byColumn.new?.quickBuySol ?? 0.5);
  const quickBuyButtonSize = styleValues.every((v) => v === styleValues[0])
    ? (styleValues[0] ?? 'medium')
    : (byColumn.new?.buyButtonStyle ?? 'medium');
  return { displayQuickBuySol, quickBuyButtonSize };
}

function syncPulseDisplaySideEffects(prefs: PulseDisplayPrefs) {
  const col = usePulseColumnStore.getState();
  col.setBuyButtonStyleAll(prefs.quickBuyButtonSize);
  // Quick-buy SOL amounts are owned by pointer-pulse-columns-ton — do not reset on display prefs rehydrate.

  if (typeof document !== 'undefined') {
    const root = document.documentElement;
    root.setAttribute('data-pulse-mc-metric', prefs.mcMetricSize);
    root.setAttribute('data-pulse-circle-avatars', String(prefs.circleAvatars));
    root.setAttribute('data-pulse-no-decimals', String(prefs.noDecimals));
    root.setAttribute('data-pulse-color-row', String(prefs.colorRowByProtocol));
    root.setAttribute('data-pulse-transparent-rows', String(prefs.transparentRows));
    root.setAttribute('data-pulse-qb-chrome', prefs.quickBuyUltraChrome);
    applyPulseAccentToDocument(prefs.accentHex);
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
          if (
            patch.displayQuickBuySol != null &&
            Number.isFinite(patch.displayQuickBuySol) &&
            patch.displayQuickBuySol > 0
          ) {
            for (const id of COLUMN_IDS) {
              usePulseColumnStore.getState().setQuickBuySol(id, patch.displayQuickBuySol);
            }
          }
          return { ...s, ...next };
        }),
      resetPrefs: () => {
        syncPulseDisplaySideEffects(DEFAULT_PULSE_DISPLAY_PREFS);
        set((s) => ({ ...s, ...DEFAULT_PULSE_DISPLAY_PREFS }));
      },
      hydrateQuickBuyFromColumns: () =>
        set((s) => {
          const { displayQuickBuySol, quickBuyButtonSize } = getConsensusQuickBuyFromColumns(
            usePulseColumnStore.getState().byColumn,
          );
          return { ...s, displayQuickBuySol, quickBuyButtonSize };
        }),
    }),
    {
      name: 'pointer.pulse-display',
      version: 6,
      partialize: (s) => pickPulseDisplayPrefs(s),
      migrate: (persisted, fromVersion) => {
        let base = withPulseDisplayDefaults(persisted as Partial<PulseDisplayPrefs> | undefined);
        if (fromVersion < 3 && base.accentHex === '#526EEE') {
          base = { ...base, accentHex: DEFAULT_PULSE_DISPLAY_PREFS.accentHex };
        }
        // Axiom parity — per-column ticker/name search stays visible in the header center.
        if (fromVersion < 4) {
          base = { ...base, hideColumnSearch: false };
        }
        if (fromVersion < 5 && base.quickBuyUltraChrome == null) {
          base = { ...base, quickBuyUltraChrome: DEFAULT_PULSE_DISPLAY_PREFS.quickBuyUltraChrome };
        }
        if (fromVersion < 6 && base.toastColor === undefined) {
          base = { ...base, toastColor: null };
        }
        return base;
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
