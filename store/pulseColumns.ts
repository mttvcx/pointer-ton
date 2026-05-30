'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { PulseColumnId } from '@/lib/utils/constants';
import type { BuyButtonStyle, ColumnFilters } from '@/lib/tokens/columnPresetModel';
import { BUY_BUTTON_STYLES } from '@/lib/tokens/columnPresetModel';

export type PulseRowDensity = 'compact' | 'normal' | 'expanded';

export type ColumnPulsePresetSlot = 1 | 2 | 3;

type PerColumn = {
  quickBuySol: number;
  quickBuyUsdc: number;
  density: PulseRowDensity;
  presetSlot: ColumnPulsePresetSlot;
  buyButtonStyle: BuyButtonStyle;
  /** Local-only preset filters when signed out (keyed by P1–P3). */
  localFiltersBySlot: Partial<Record<ColumnPulsePresetSlot, ColumnFilters>>;
};

type PulseColumnsState = {
  byColumn: Record<PulseColumnId, PerColumn>;
  setQuickBuySol: (column: PulseColumnId, sol: number) => void;
  setQuickBuyUsdc: (column: PulseColumnId, usdc: number) => void;
  cycleDensity: (column: PulseColumnId) => void;
  setPresetSlot: (column: PulseColumnId, slot: ColumnPulsePresetSlot) => void;
  setDensity: (column: PulseColumnId, density: PulseRowDensity) => void;
  setBuyButtonStyle: (column: PulseColumnId, style: BuyButtonStyle) => void;
  /** Pulse buy pill / ultra: same style on every column (Axiom-style global control). */
  setBuyButtonStyleAll: (style: BuyButtonStyle) => void;
  setLocalColumnFilters: (
    column: PulseColumnId,
    slot: ColumnPulsePresetSlot,
    filters: ColumnFilters,
  ) => void;
  clearLocalColumnFilters: (column: PulseColumnId, slot?: ColumnPulsePresetSlot) => void;
};

function coerceBuyButtonStyle(s: unknown, fallback: BuyButtonStyle): BuyButtonStyle {
  if (s === 'normal') return 'medium';
  if (s === 'outline') return 'ultra';
  if (s === 'mega') return 'large';
  if (typeof s === 'string' && (BUY_BUTTON_STYLES as readonly string[]).includes(s)) {
    return s as BuyButtonStyle;
  }
  return fallback;
}

const defaults = (): PerColumn => ({
  quickBuySol: 0.5,
  quickBuyUsdc: 25,
  density: 'expanded',
  presetSlot: 1,
  buyButtonStyle: 'medium',
  localFiltersBySlot: {},
});

const seed: Record<PulseColumnId, PerColumn> = {
  new: defaults(),
  stretch: defaults(),
  migrated: defaults(),
};

function cycleDensity(d: PulseRowDensity): PulseRowDensity {
  if (d === 'compact') return 'normal';
  if (d === 'normal') return 'expanded';
  return 'compact';
}

export const usePulseColumnStore = create<PulseColumnsState>()(
  persist(
    (set) => ({
      byColumn: seed,
      setQuickBuySol: (column, sol) =>
        set((s) => ({
          byColumn: {
            ...s.byColumn,
            [column]: { ...s.byColumn[column], quickBuySol: sol },
          },
        })),
      setQuickBuyUsdc: (column, usdc) =>
        set((s) => ({
          byColumn: {
            ...s.byColumn,
            [column]: { ...s.byColumn[column], quickBuyUsdc: usdc },
          },
        })),
      cycleDensity: (column) =>
        set((s) => ({
          byColumn: {
            ...s.byColumn,
            [column]: {
              ...s.byColumn[column],
              density: cycleDensity(s.byColumn[column].density),
            },
          },
        })),
      setPresetSlot: (column, presetSlot) =>
        set((s) => ({
          byColumn: {
            ...s.byColumn,
            [column]: { ...s.byColumn[column], presetSlot },
          },
        })),
      setDensity: (column, density) =>
        set((s) => ({
          byColumn: {
            ...s.byColumn,
            [column]: { ...s.byColumn[column], density },
          },
        })),
      setBuyButtonStyle: (column, buyButtonStyle) =>
        set((s) => ({
          byColumn: {
            ...s.byColumn,
            [column]: { ...s.byColumn[column], buyButtonStyle },
          },
        })),
      setBuyButtonStyleAll: (buyButtonStyle) =>
        set((s) => ({
          byColumn: {
            new: { ...s.byColumn.new, buyButtonStyle },
            stretch: { ...s.byColumn.stretch, buyButtonStyle },
            migrated: { ...s.byColumn.migrated, buyButtonStyle },
          },
        })),
      setLocalColumnFilters: (column, slot, filters) =>
        set((s) => ({
          byColumn: {
            ...s.byColumn,
            [column]: {
              ...s.byColumn[column],
              localFiltersBySlot: {
                ...s.byColumn[column].localFiltersBySlot,
                [slot]: filters,
              },
            },
          },
        })),
      clearLocalColumnFilters: (column, slot) =>
        set((s) => {
          const row = s.byColumn[column];
          if (!slot) {
            return {
              byColumn: {
                ...s.byColumn,
                [column]: { ...row, localFiltersBySlot: {} },
              },
            };
          }
          const next = { ...row.localFiltersBySlot };
          delete next[slot];
          return {
            byColumn: {
              ...s.byColumn,
              [column]: { ...row, localFiltersBySlot: next },
            },
          };
        }),
    }),
    {
      /** TON build: avoids reusing saved per-column “compact” density from older sessions. */
      name: 'pointer-pulse-columns-ton',
      partialize: (s) => ({ byColumn: s.byColumn }),
      merge: (persisted, current) => {
        const p = persisted as
          | { byColumn?: Partial<Record<PulseColumnId, Partial<PerColumn>>> }
          | undefined;
        if (!p?.byColumn) return current;
        const byColumn = { ...current.byColumn };
        const ids: PulseColumnId[] = ['new', 'stretch', 'migrated'];
        for (const col of ids) {
          const row = p.byColumn[col];
          if (row) {
            byColumn[col] = {
              ...current.byColumn[col],
              ...row,
              localFiltersBySlot: row.localFiltersBySlot ?? current.byColumn[col].localFiltersBySlot ?? {},
              quickBuyUsdc:
                typeof row.quickBuyUsdc === 'number' && Number.isFinite(row.quickBuyUsdc)
                  ? row.quickBuyUsdc
                  : current.byColumn[col].quickBuyUsdc,
              buyButtonStyle: coerceBuyButtonStyle(
                row.buyButtonStyle,
                current.byColumn[col].buyButtonStyle,
              ),
            };
          }
        }
        return { ...current, byColumn };
      },
    },
  ),
);
