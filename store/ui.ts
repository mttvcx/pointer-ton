'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppChainId } from '@/lib/chains/appChain';
import { DEFAULT_APP_CHAIN, normalizePersistedAppChain } from '@/lib/chains/appChain';

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
  /** When floating with left anchor: distance from viewport left. */
  copilotLeft: number;
  /** True = floating panel positioned with `left`+`width`; false = `right`+`width`. */
  copilotFloatUseLeftAnchor: boolean;
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

  /** Selected network in the header toggle (Sol · BNB · Base · TON; no Bitcoin L1). */
  activeChain: AppChainId;

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
  setCopilotFloatLeft: (top: number, left: number) => void;
  setCopilotRailSide: (side: 'left' | 'right') => void;
  setCopilotFloatHeight: (px: number | null) => void;
  setCopilotDisplayMode: (mode: 'panel' | 'pill') => void;
  setCopilotPillExpanded: (open: boolean) => void;
  /** Draggable pill position (px) relative to default top-center anchor. */
  copilotPillOffsetX: number;
  copilotPillOffsetY: number;
  setCopilotPillOffset: (x: number, y: number) => void;

  /**
   * `header` — pill sits in the top bar center track (with nudge offsets).
   * `free` — pill is a tiny floating chip anywhere on the page; drag into the top snap band to dock.
   */
  copilotPillAnchor: 'header' | 'free';
  copilotPillFreeLeft: number;
  copilotPillFreeTop: number;
  setCopilotPillAnchor: (anchor: 'header' | 'free') => void;
  setCopilotPillFreePos: (left: number, top: number) => void;

  /**
   * Which side of the shell the docked co-pilot rail attaches to.
   * Floating drag to screen edges updates this when snapping in.
   */
  copilotRailSide: 'left' | 'right';

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
  setActiveChain: (chain: AppChainId) => void;

  /** Pointer-branded sign-in overlay (Google/X use popup OAuth). */
  signInModalOpen: boolean;
  setSignInModalOpen: (open: boolean) => void;
  openSignInModal: () => void;

  /** Automation / Track: flash a Pulse row by mint (non-persisted). */
  trackPulseHighlightMint: string | null;
  flashTrackPulseMint: (mint: string, ms?: number) => void;
  clearTrackPulseFlash: () => void;

  /**
   * While the embedded co-pilot strip (below the top bar) is expanded, treat the
   * co-pilot AI surface as open even if the right rail is collapsed — same hover
   * explain queries as the side panel.
   */
  copilotTopStripActive: boolean;
  setCopilotTopStripActive: (active: boolean) => void;

  /** Top Cluely strip: AI briefing vs Pulse alert builder when the side rail is closed. */
  copilotStripTab: 'brief' | 'alerts';
  setCopilotStripTab: (tab: 'brief' | 'alerts') => void;

  /** Centered Pulse alerts dialog (matches Settings modal pattern). */
  alertRulesModalOpen: boolean;
  setAlertRulesModalOpen: (open: boolean) => void;

  /** Centered settings overlay — tab selects Watchlist vs General. */
  settingsOpen: boolean;
  settingsTab: 'general' | 'watchlist';
  setSettingsOpen: (open: boolean) => void;
  openSettings: (tab?: 'general' | 'watchlist') => void;
  /** Cross-surface trigger to open the wallet ExchangeModal (hosted in Topbar). */
  exchangeRequest: { tab: 'convert' | 'deposit' | 'withdraw' | 'buy'; nonce: number } | null;
  requestExchange: (tab?: 'convert' | 'deposit' | 'withdraw' | 'buy') => void;
  clearExchangeRequest: () => void;
}

const PANEL_DEFAULT = 380;
const PANEL_MIN = 320;
const PANEL_MAX = 480;
const PANEL_MIN_FLOAT = 260;
const PANEL_MAX_FLOAT = 720;

/** Single pending auto-clear timer for the Pulse track-flash highlight. */
let trackPulseFlashTimer: ReturnType<typeof setTimeout> | null = null;

/** Left-rail alert builder: keep narrow so Pulse still fits with co-pilot open. */
export const ALERT_DOCK_MIN_W = 240;
export const ALERT_DOCK_MAX_W = 400;
export const ALERT_DOCK_DEFAULT_W = 292;

function sameEntity(a: EntityRef | null, b: EntityRef | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  return a.type === b.type && a.id === b.id && (a.label ?? null) === (b.label ?? null);
}

export function computeCopilotAlertsReadIso(alerts: { createdAt: string }[] | undefined): string {
  if (!alerts?.length) return new Date().toISOString();
  const maxT = Math.max(...alerts.map((a) => new Date(a.createdAt).getTime()));
  return new Date(maxT).toISOString();
}

/**
 * True when the co-pilot surface is visible and interactive (expanded rail, expanded pill, or floating window).
 * When false, skip background AI + ticker work to avoid wasted API calls.
 */
export function selectCopilotSurfaceOpen(s: UIState): boolean {
  if (s.copilotTopStripActive) return true;
  if (s.copilotDisplayMode === 'pill') {
    return s.copilotPillExpanded;
  }
  if (!s.panelOpen) return false;
  if (s.copilotDetached) return true;
  return !s.panelCollapsed;
}

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      lockedEntity: null,
      hoveredEntity: null,
      // Closed by default — never auto-open on a fresh sign-in. The user opens the
      // co-pilot view deliberately (pill / topbar / `]`).
      panelOpen: false,
      panelCollapsed: false,
      panelWidth: PANEL_DEFAULT,
      lastCopilotAlertsReadAt: null,
      copilotDetached: false,
      copilotTop: 72,
      copilotRight: 12,
      copilotLeft: 12,
      copilotFloatUseLeftAnchor: false,
      copilotRailSide: 'right',
      copilotFloatHeight: null,
      copilotDisplayMode: 'panel',
      copilotPillExpanded: false,
      copilotPillOffsetX: 0,
      copilotPillOffsetY: 0,
      copilotPillAnchor: 'header',
      copilotPillFreeLeft: 48,
      copilotPillFreeTop: 120,
      alertRulesPopout: null,
      alertRulesDocked: false,
      alertRulesDockWidth: ALERT_DOCK_DEFAULT_W,
      searchQuery: '',
      searchOpen: false,
      signInModalOpen: false,
      activeChain: DEFAULT_APP_CHAIN,
      trackPulseHighlightMint: null,
      copilotTopStripActive: false,
      copilotStripTab: 'brief',
      alertRulesModalOpen: false,
      settingsOpen: false,
      settingsTab: 'general',
      exchangeRequest: null,

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
          return {
            copilotDetached: true,
            ...(s.copilotRailSide === 'left'
              ? {
                  copilotFloatUseLeftAnchor: true,
                  copilotLeft: 12,
                  copilotTop: Math.max(52, s.copilotTop),
                }
              : {
                  copilotFloatUseLeftAnchor: false,
                  copilotRight: 12,
                  copilotTop: Math.max(52, s.copilotTop),
                }),
          };
        }),
      setCopilotFloat: (top, right) =>
        set({ copilotTop: top, copilotRight: right, copilotFloatUseLeftAnchor: false }),
      setCopilotFloatLeft: (top, left) =>
        set({ copilotTop: top, copilotLeft: left, copilotFloatUseLeftAnchor: true }),
      setCopilotRailSide: (side) => set({ copilotRailSide: side }),
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
      setCopilotPillAnchor: (anchor) => set({ copilotPillAnchor: anchor }),
      setCopilotPillFreePos: (left, top) =>
        set({
          copilotPillFreeLeft: Math.min(4000, Math.max(4, Math.round(left))),
          copilotPillFreeTop: Math.min(4000, Math.max(4, Math.round(top))),
        }),
      setAlertRulesPopout: (rect) => set({ alertRulesPopout: rect }),
      setAlertRulesDocked: (docked) =>
        set(() => ({
          alertRulesDocked: docked,
          ...(docked ? { alertRulesPopout: null } : {}),
        })),
      setAlertRulesDockWidth: (px) =>
        set({
          alertRulesDockWidth: Math.min(ALERT_DOCK_MAX_W, Math.max(ALERT_DOCK_MIN_W, Math.round(px))),
        }),
      setSearchQuery: (q) => set({ searchQuery: q }),
      setSearchOpen: (open) => set({ searchOpen: open }),
      setSignInModalOpen: (open) => set({ signInModalOpen: open }),
      openSignInModal: () => set({ signInModalOpen: true }),
      setActiveChain: (chain) => set({ activeChain: chain }),

      flashTrackPulseMint: (mint, ms = 12_000) => {
        const trimmed = mint.trim();
        if (!trimmed) return;
        if (trackPulseFlashTimer) clearTimeout(trackPulseFlashTimer);
        set({ trackPulseHighlightMint: trimmed });
        trackPulseFlashTimer = setTimeout(() => {
          trackPulseFlashTimer = null;
          const cur = useUIStore.getState().trackPulseHighlightMint;
          if (cur === trimmed) set({ trackPulseHighlightMint: null });
        }, ms);
      },
      clearTrackPulseFlash: () => {
        if (trackPulseFlashTimer) {
          clearTimeout(trackPulseFlashTimer);
          trackPulseFlashTimer = null;
        }
        set({ trackPulseHighlightMint: null });
      },

      setCopilotTopStripActive: (active) => set({ copilotTopStripActive: active }),
      setCopilotStripTab: (tab) => set({ copilotStripTab: tab }),
      setAlertRulesModalOpen: (modalOpen) => set({ alertRulesModalOpen: modalOpen }),
      setSettingsOpen: (open) => set({ settingsOpen: open }),
      openSettings: (tab = 'general') =>
        set({ settingsOpen: true, settingsTab: tab }),
      requestExchange: (tab = 'deposit') =>
        set((s) => ({ exchangeRequest: { tab, nonce: (s.exchangeRequest?.nonce ?? 0) + 1 } })),
      clearExchangeRequest: () => set({ exchangeRequest: null }),
    }),
    {
      name: 'pointer-ui',
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<UIState>;
        const chain = normalizePersistedAppChain(p.activeChain);
        /*
         * Legacy `pill` mode swapped `AICopilotPanel` for `CopilotPillHost` only (no docked rail),
         * which breaks the top-bar Cluely strip + right “Co-pilot” toggle. Migrate stored prefs.
         */
        const copilotDisplayMode =
          p.copilotDisplayMode === 'pill' ? ('panel' as const) : (p.copilotDisplayMode ?? current.copilotDisplayMode);
        return {
          ...current,
          ...p,
          ...(chain !== null ? { activeChain: chain } : {}),
          copilotDisplayMode,
        };
      },
      partialize: (s) => ({
        panelOpen: s.panelOpen,
        panelCollapsed: s.panelCollapsed,
        lastCopilotAlertsReadAt: s.lastCopilotAlertsReadAt,
        panelWidth: s.panelWidth,
        copilotDetached: s.copilotDetached,
        copilotTop: s.copilotTop,
        copilotRight: s.copilotRight,
        copilotLeft: s.copilotLeft,
        copilotFloatUseLeftAnchor: s.copilotFloatUseLeftAnchor,
        copilotRailSide: s.copilotRailSide,
        copilotFloatHeight: s.copilotFloatHeight,
        copilotDisplayMode: s.copilotDisplayMode,
        copilotPillOffsetX: s.copilotPillOffsetX,
        copilotPillOffsetY: s.copilotPillOffsetY,
        copilotPillAnchor: s.copilotPillAnchor,
        copilotPillFreeLeft: s.copilotPillFreeLeft,
        copilotPillFreeTop: s.copilotPillFreeTop,
        alertRulesDocked: s.alertRulesDocked,
        alertRulesDockWidth: s.alertRulesDockWidth,
        activeChain: s.activeChain,
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
