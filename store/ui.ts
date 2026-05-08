'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Lightweight UI state shared across the layout shell.
 *
 * Hover/lock plumbing (Step 11):
 *   - `hoveredEntity`  - what a list row is currently pointing at (debounced
 *                        in TokenRow / via `useEntityHover`).
 *   - `lockedEntity`   - what the AI Co-pilot panel is pinned to. Two sources:
 *       - `'route'`    - a detail page mounted `<EntityLocker />`. Cleared
 *                        only when that page unmounts (and only if still us).
 *       - `'manual'`   - the user clicked Pin in the co-pilot. Persists across
 *                        navigation; Esc dismisses it (when not in an input).
 *   - `selectActiveEntity` returns lock-then-hover so the panel always shows
 *     the right thing.
 */

export type EntityKind = 'token' | 'wallet';

export interface EntityRef {
  type: EntityKind;
  id: string;
  label?: string;
}

export type LockSource = 'route' | 'manual';

export interface LockedEntity extends EntityRef {
  source: LockSource;
}

interface UIState {
  lockedEntity: LockedEntity | null;
  hoveredEntity: EntityRef | null;

  panelOpen: boolean;
  panelCollapsed: boolean;
  panelWidth: number;
  lastCopilotAlertsReadAt: string | null;

  /** When true, co-pilot renders as a floating window (draggable). */
  copilotDetached: boolean;
  copilotTop: number;
  copilotRight: number;
  /** When set, floating co-pilot uses this height (px); otherwise full column below top bar. */
  copilotFloatHeight: number | null;

  /**
   * `panel` — right rail (default). `pill` — Cluely-style top-center floating pill;
   * right panel hidden while pill mode is active.
   */
  copilotDisplayMode: 'panel' | 'pill';

  /** Expanded “card” state when in pill mode (also driven from top bar “Co-pilot”). */
  copilotPillExpanded: boolean;

  searchQuery: string;
  searchOpen: boolean;

  setHovered: (entity: EntityRef | null) => void;
  setLocked: (entity: EntityRef | null, source?: LockSource) => void;
  pinHovered: () => void;
  clearLocked: (opts?: { onlyManual?: boolean }) => void;

  togglePanel: () => void;
  setPanelOpen: (open: boolean) => void;
  setPanelCollapsed: (collapsed: boolean) => void;
  markCopilotAlertsRead: (alerts: { createdAt: string }[]) => void;
  setPanelWidth: (px: number) => void;
  setCopilotDetached: (detached: boolean) => void;
  setCopilotFloat: (top: number, right: number) => void;
  setCopilotFloatHeight: (px: number | null) => void;
  setCopilotDisplayMode: (mode: 'panel' | 'pill') => void;
  setCopilotPillExpanded: (open: boolean) => void;
  /** Draggable pill position (px) relative to default top-center anchor. */
  copilotPillOffsetX: number;
  copilotPillOffsetY: number;
  setCopilotPillOffset: (x: number, y: number) => void;

  /** Detached alert builder (floating). Null when docked. */
  alertRulesPopout: { top: number; left: number; width: number; height: number } | null;
  setAlertRulesPopout: (rect: { top: number; left: number; width: number; height: number } | null) => void;
  /** Docked left rail (pushes main content like co-pilot on the right). */
  alertRulesDocked: boolean;
  alertRulesDockWidth: number;
  setAlertRulesDocked: (docked: boolean) => void;
  setAlertRulesDockWidth: (px: number) => void;

  setSearchQuery: (q: string) => void;
  setSearchOpen: (open: boolean) => void;
}

const PANEL_DEFAULT = 380;
const PANEL_MIN = 320;
const PANEL_MAX = 480;
const PANEL_MIN_FLOAT = 260;
const PANEL_MAX_FLOAT = 720;

function sameEntity(a: EntityRef | null, b: EntityRef | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.type === b.type && a.id === b.id && (a.label ?? null) === (b.label ?? null);
}

export function computeCopilotAlertsReadIso(alerts: { createdAt: string }[]): string {
  if (alerts.length === 0) return new Date().toISOString();
  const maxT = Math.max(...alerts.map((a) => new Date(a.createdAt).getTime()));
  return new Date(maxT).toISOString();
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      lockedEntity: null,
      hoveredEntity: null,
      panelOpen: true,
      panelCollapsed: false,
      panelWidth: PANEL_DEFAULT,
      lastCopilotAlertsReadAt: null,
      copilotDetached: false,
      copilotTop: 72,
      copilotRight: 12,
      copilotFloatHeight: null,
      copilotDisplayMode: 'panel',
      copilotPillExpanded: false,
      copilotPillOffsetX: 0,
      copilotPillOffsetY: 0,
      alertRulesPopout: null,
      alertRulesDocked: false,
      alertRulesDockWidth: 380,
      searchQuery: '',
      searchOpen: false,

      setHovered: (entity) => {
        if (sameEntity(entity, get().hoveredEntity)) return;
        set({ hoveredEntity: entity });
      },
      setLocked: (entity, source = 'route') => {
        set({ lockedEntity: entity ? { ...entity, source } : null });
      },
      pinHovered: () => {
        const hovered = get().hoveredEntity ?? get().lockedEntity;
        if (!hovered) return;
        set({
          lockedEntity: {
            type: hovered.type,
            id: hovered.id,
            label: hovered.label,
            source: 'manual',
          },
        });
      },
      clearLocked: (opts) => {
        if (opts?.onlyManual) {
          const cur = get().lockedEntity;
          if (!cur || cur.source !== 'manual') return;
        }
        set({ lockedEntity: null });
      },

      togglePanel: () =>
        set((s) =>
          s.panelOpen
            ? { panelOpen: false, panelCollapsed: false }
            : { panelOpen: true, panelCollapsed: false },
        ),
      setPanelOpen: (open) => set({ panelOpen: open, panelCollapsed: false }),
      setPanelCollapsed: (collapsed) => set({ panelCollapsed: collapsed }),
      markCopilotAlertsRead: (alerts) =>
        set({ lastCopilotAlertsReadAt: computeCopilotAlertsReadIso(alerts) }),
      setPanelWidth: (px) =>
        set((s) => {
          const max = s.copilotDetached ? PANEL_MAX_FLOAT : PANEL_MAX;
          const min = s.copilotDetached ? PANEL_MIN_FLOAT : PANEL_MIN;
          return { panelWidth: Math.min(max, Math.max(min, px)) };
        }),
      setCopilotDetached: (detached) =>
        set((s) => {
          if (detached === s.copilotDetached) return {};
          if (!detached) {
            return {
              copilotDetached: false,
              panelWidth: Math.min(PANEL_MAX, Math.max(PANEL_MIN, s.panelWidth)),
              copilotFloatHeight: null,
            };
          }
          return { copilotDetached: true };
        }),
      setCopilotFloat: (top, right) => set({ copilotTop: top, copilotRight: right }),
      setCopilotFloatHeight: (px) => set({ copilotFloatHeight: px }),
      setCopilotDisplayMode: (mode) =>
        set((s) => ({
          copilotDisplayMode: mode,
          copilotPillExpanded: mode === 'pill' ? s.copilotPillExpanded : false,
          ...(mode === 'pill'
            ? { panelOpen: true, panelCollapsed: false, copilotDetached: false, copilotFloatHeight: null }
            : {}),
        })),
      setCopilotPillExpanded: (open) => set({ copilotPillExpanded: open }),
      setCopilotPillOffset: (x, y) =>
        set({
          copilotPillOffsetX: Math.min(800, Math.max(-800, Math.round(x))),
          copilotPillOffsetY: Math.min(520, Math.max(-32, Math.round(y))),
        }),
      setAlertRulesPopout: (rect) => set({ alertRulesPopout: rect }),
      setAlertRulesDocked: (docked) =>
        set(() => ({
          alertRulesDocked: docked,
          ...(docked ? { alertRulesPopout: null } : {}),
        })),
      setAlertRulesDockWidth: (px) =>
        set({ alertRulesDockWidth: Math.min(520, Math.max(300, Math.round(px))) }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setSearchOpen: (open) => set({ searchOpen: open }),
    }),
    {
      name: 'pointer-ui',
      partialize: (s) => ({
        panelCollapsed: s.panelCollapsed,
        lastCopilotAlertsReadAt: s.lastCopilotAlertsReadAt,
        panelWidth: s.panelWidth,
        copilotDetached: s.copilotDetached,
        copilotTop: s.copilotTop,
        copilotRight: s.copilotRight,
        copilotFloatHeight: s.copilotFloatHeight,
        copilotDisplayMode: s.copilotDisplayMode,
        copilotPillOffsetX: s.copilotPillOffsetX,
        copilotPillOffsetY: s.copilotPillOffsetY,
        alertRulesDocked: s.alertRulesDocked,
        alertRulesDockWidth: s.alertRulesDockWidth,
      }),
    },
  ),
);

export function selectActiveEntity(s: UIState): EntityRef | null {
  return s.lockedEntity ?? s.hoveredEntity;
}

export function selectLockSource(s: UIState): LockSource | null {
  return s.lockedEntity?.source ?? null;
}
