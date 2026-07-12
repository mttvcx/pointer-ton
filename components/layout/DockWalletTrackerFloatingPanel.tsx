'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { BellRing } from 'lucide-react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import type { MyWalletRow } from '@/lib/hooks/useActiveSolanaWallet';
import { WalletGroupsSidebar } from '@/components/portfolio/WalletGroupsSidebar';
import { useWalletGroupsStore } from '@/store/walletGroups';
import { useTradingStore } from '@/store/trading';
import { UNGROUPED_GROUP_ID } from '@/lib/trade/walletGroups';
import { CloseButton } from '@/components/ui/CloseButton';
import {
  clampPeekTopLeftWithinViewport,
  DOCK_PEEK_BOTTOM_CSS,
  DOCK_PEEK_TOP_GAP_PX,
  readDockPeekTopPx,
  readLayoutChromePx,
  snapDockPeekCoords,
} from '@/lib/layout/dockPeekSnap';
import { stickyDockSideFromFloatingRect } from '@/lib/layout/floatingPeekSticky';
import {
  clampDockPeekWidth,
  DEFAULT_WALLET_TRACKER_PEEK_SIZE,
  useTokenDockPeekStore,
  type PeekDockSnapSide,
} from '@/store/tokenDockPeek';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';
import { toastWalletTrackedTradeDemo } from '@/lib/walletTracker/walletTrackerToast';
import { TrackerTradesFeed } from '@/components/trackers/TrackerTradesFeed';
import { WalletQuickBuyAmount } from '@/components/trackers/WalletQuickBuyAmount';
import { WalletTrackerKolsTab } from '@/components/trackers/WalletTrackerKolsTab';

type WalletTrackerTab = 'trades' | 'groups' | 'kols';

const TAB_LABEL: Record<WalletTrackerTab, string> = {
  trades: 'Trades',
  groups: 'Groups',
  kols: 'KOLs',
};
const TAB_ORDER: WalletTrackerTab[] = ['trades', 'groups', 'kols'];

const MIN_PANEL_W = 300;
const MIN_PANEL_H = 300;
const EDGE_GHOST_W_PX = 72;
const BODY_GUTTER_PX = 10;
const BODY_GUTTER_EXTRA_PX = 10;
/** Collapsed width of the co-pilot rail (mirrors RAIL_PX in AICopilotPanel). */
const COPILOT_RAIL_PX = 44;

function DockPeekWidthHandle({
  edge,
  draggingUi,
  onPointerDown,
}: {
  edge: 'left' | 'right';
  draggingUi: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  return (
    <div
      className={cn(
        'absolute top-0 bottom-0 z-20 w-4 cursor-ew-resize',
        edge === 'right' ? 'right-0' : 'left-0',
        draggingUi ? 'pointer-events-none' : 'group/resize',
      )}
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
    >
      <div
        className={cn(
          'pointer-events-none absolute top-[12%] bottom-[12%] w-px bg-white/0 transition-colors group-hover/resize:bg-white/30',
          edge === 'right' ? 'right-[5px]' : 'left-[5px]',
        )}
        aria-hidden
      />
      <span className="sr-only">Resize panel width</span>
    </div>
  );
}

/** Free-float edge resize handle (any of the 4 sides). */
function EdgeResizeHandle({
  side,
  draggingUi,
  onPointerDown,
}: {
  side: 'top' | 'bottom' | 'left' | 'right';
  draggingUi: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const isX = side === 'left' || side === 'right';
  return (
    <div
      className={cn(
        'absolute z-20',
        draggingUi ? 'pointer-events-none' : 'group/rz',
        isX ? 'top-4 bottom-4 w-3 cursor-ew-resize' : 'left-4 right-4 h-3 cursor-ns-resize',
        side === 'left' && 'left-0',
        side === 'right' && 'right-0',
        side === 'top' && 'top-0',
        side === 'bottom' && 'bottom-0',
      )}
      style={{ touchAction: 'none' }}
      onPointerDown={onPointerDown}
    >
      <div
        aria-hidden
        className={cn(
          'pointer-events-none absolute bg-white/0 transition-colors group-hover/rz:bg-white/30',
          isX ? 'top-[12%] bottom-[12%] w-px' : 'left-[12%] right-[12%] h-px',
          side === 'left' && 'left-[5px]',
          side === 'right' && 'right-[5px]',
          side === 'top' && 'top-[5px]',
          side === 'bottom' && 'bottom-[5px]',
        )}
      />
    </div>
  );
}

/** Free-float corner resize handle (diagonal). */
function CornerResizeHandle({
  corner,
  draggingUi,
  onPointerDown,
}: {
  corner: 'tl' | 'tr' | 'bl' | 'br';
  draggingUi: boolean;
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}) {
  const nwse = corner === 'tl' || corner === 'br';
  return (
    <div
      role="separator"
      className={cn(
        'group/corner absolute z-[21]',
        nwse ? 'cursor-nwse-resize' : 'cursor-nesw-resize',
        draggingUi ? 'pointer-events-none' : '',
        corner === 'tl' && 'left-0 top-0',
        corner === 'tr' && 'right-0 top-0',
        corner === 'bl' && 'bottom-0 left-0',
        corner === 'br' && 'bottom-0 right-0',
      )}
      style={{ touchAction: 'none', width: 16, height: 16 }}
      onPointerDown={onPointerDown}
    >
      {corner === 'br' ? (
        <span
          aria-hidden
          className="pointer-events-none absolute bottom-[3px] right-[3px] h-[8px] w-[8px] rounded-br-[3px] border-b border-r border-white/25 transition-colors group-hover/corner:border-white/55"
        />
      ) : null}
      <span className="sr-only">Resize Tracker panel</span>
    </div>
  );
}

/** Center grip — mirrored from Pulse peek */
function GripDots() {
  return (
    <div
      className="pointer-events-none grid shrink-0 grid-cols-2 gap-[4px] text-fg-muted opacity-[0.14]"
      aria-hidden
    >
      {Array.from({ length: 6 }, (_, i) => (
        <span key={i} className="h-[3px] w-[3px] rounded-full bg-current" />
      ))}
    </div>
  );
}

/**
 * Wallet / Trades Tracker peek — draggable, resizable, edge-docks like Pulse
 * (blur pinch-in + panel-geometry snapping + layout pad).
 */
export function DockWalletTrackerFloatingPanel() {
  const pathname = usePathname();
  const activeChain = useUIStore((s) => s.activeChain);
  // Co-pilot right rail — offset the dock so it sits beside it, not under it.
  const copilotOpen = useUIStore((s) => s.panelOpen);
  const copilotDetached = useUIStore((s) => s.copilotDetached);
  const copilotRailSide = useUIStore((s) => s.copilotRailSide);
  const copilotCollapsed = useUIStore((s) => s.panelCollapsed);
  const copilotWidth = useUIStore((s) => s.panelWidth);
  const open = useTokenDockPeekStore((s) => s.walletPeekOpen);
  const setOpen = useTokenDockPeekStore((s) => s.setWalletPeekOpen);
  const position = useTokenDockPeekStore((s) => s.dockWalletPosition);
  const setPosition = useTokenDockPeekStore((s) => s.setDockWalletPosition);
  const dockSnap = useTokenDockPeekStore((s) => s.dockWalletDockSnap);
  const setDockSnap = useTokenDockPeekStore((s) => s.setWalletDockSnap);
  const panelSize = useTokenDockPeekStore((s) => s.dockWalletPanelSize ?? DEFAULT_WALLET_TRACKER_PEEK_SIZE);
  const setPanelSize = useTokenDockPeekStore((s) => s.setWalletPanelSize);

  const [tab, setTab] = useState<WalletTrackerTab>('trades');

  const onWalletMgmtPage = pathname?.startsWith('/wallets') ?? false;

  const shellRef = useRef<HTMLElement | null>(null);
  const draggingRef = useRef(false);
  const resizingRef = useRef(false);
  const transientSizeRef = useRef<{ w: number; h: number } | null>(null);

  type MovePhase = { pointerId: number; origX: number; origY: number; startX: number; startY: number };
  const movePhaseRef = useRef<MovePhase | null>(null);

  type ResizePhase = {
    pointerId: number;
    ow: number;
    oh: number;
    startX: number;
    startY: number;
    axis: 'both' | 'ew' | 'ns';
    /** Free-float resize: which edges are being dragged + the origin top-left. */
    ox?: number;
    oy?: number;
    edgeX?: 'left' | 'right' | null;
    edgeY?: 'top' | 'bottom' | null;
  };
  const resizePhaseRef = useRef<ResizePhase | null>(null);

  const [draggingUi, setDraggingUi] = useState(false);
  const [dockGlow, setDockGlow] = useState<null | 'left' | 'right'>(null);
  const dockGlowRef = useRef(dockGlow);
  dockGlowRef.current = dockGlow;
  const lastFloatingLayoutRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);

  const [, bumpResizeUi] = useState(0);
  const [layoutEpoch, bumpLayoutEpoch] = useState(0);
  const onPulse = pathname?.startsWith('/pulse') ?? false;

  useEffect(() => {
    if (onWalletMgmtPage && open) setOpen(false);
  }, [onWalletMgmtPage, open, setOpen]);

  // Wallet tracker is available on SOL + EVM (eth/bnb/base). Only TON has no
  // tracked-wallet data, so close there.
  const trackerChainSupported = activeChain !== 'ton';
  useEffect(() => {
    if (!trackerChainSupported && open) setOpen(false);
  }, [trackerChainSupported, open, setOpen]);

  const readMetrics = () => {
    const { topbar, botbar } = readLayoutChromePx();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    // Float math uses the standard band (sits below Pulse chrome on Pulse).
    const dockTopPx = readDockPeekTopPx(onPulse);
    // Edge-docked: anchor to just under the topbar so the panel reclaims the
    // empty top-left band (the copilot brief is centered, so no overlap).
    const dockedTopPx = topbar + DOCK_PEEK_TOP_GAP_PX;
    const maxFloatH = Math.max(MIN_PANEL_H, vh - dockTopPx - botbar - 12);
    const maxFloatW = Math.max(MIN_PANEL_W, vw - 24);
    // When the co-pilot is docked as the right rail, reserve its width so the
    // dock parks beside it instead of behind it (it's a fixed overlay).
    const copilotRightInset =
      vw > 1023 && copilotOpen && !copilotDetached && copilotRailSide === 'right'
        ? copilotCollapsed
          ? COPILOT_RAIL_PX
          : copilotWidth
        : 0;
    return { topbar, botbar, vw, vh, maxFloatH, maxFloatW, dockTopPx, dockedTopPx, copilotRightInset };
  };

  useEffect(() => {
    if (!open || !onPulse || typeof document === 'undefined') return;
    const main = document.querySelector('main');
    if (!main) return;
    const bump = () => bumpLayoutEpoch((n) => n + 1);
    const ro = new ResizeObserver(bump);
    ro.observe(main);
    window.addEventListener('resize', bump);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', bump);
    };
  }, [open, onPulse]);

  const clampPanelSize = useCallback((w: number, h: number) => {
    const { maxFloatH } = readMetrics();
    return {
      w: clampDockPeekWidth(w, MIN_PANEL_W),
      h: Math.round(Math.min(maxFloatH, Math.max(MIN_PANEL_H, h))),
    };
  }, []);

  const floatDimsFromRefs = useCallback((): { w: number; h: number } => {
    const st = useTokenDockPeekStore.getState();
    const sz = st.dockWalletPanelSize ?? DEFAULT_WALLET_TRACKER_PEEK_SIZE;
    const t = transientSizeRef.current;
    if (t) return clampPanelSize(t.w, t.h);
    return clampPanelSize(sz.width, sz.height);
  }, [clampPanelSize]);

  const applyBodyPadForDock = useCallback(
    (side: PeekDockSnapSide, widthPx: number) => {
      if (typeof document === 'undefined') return;
      if (!side) {
        document.documentElement.style.setProperty('--wallet-dock-pad-left', '0px');
        document.documentElement.style.setProperty('--wallet-dock-pad-right', '0px');
        return;
      }
      const w = clampPanelSize(widthPx, MIN_PANEL_H).w;
      const pad = `${w + BODY_GUTTER_EXTRA_PX}px`;
      if (side === 'left') {
        document.documentElement.style.setProperty('--wallet-dock-pad-left', pad);
        document.documentElement.style.setProperty('--wallet-dock-pad-right', '0px');
      } else {
        document.documentElement.style.setProperty('--wallet-dock-pad-left', '0px');
        document.documentElement.style.setProperty('--wallet-dock-pad-right', pad);
      }
    },
    [clampPanelSize],
  );

  useEffect(() => {
    if (!open || typeof document === 'undefined') {
      applyBodyPadForDock(null, 0);
      return;
    }
    applyBodyPadForDock(dockSnap, panelSize.width);
    return () => {
      document.documentElement.style.setProperty('--wallet-dock-pad-left', '0px');
      document.documentElement.style.setProperty('--wallet-dock-pad-right', '0px');
    };
  }, [open, dockSnap, panelSize.width, applyBodyPadForDock]);

  const floatingSnapOnce = useCallback(() => {
    const st = useTokenDockPeekStore.getState();
    if (st.dockWalletDockSnap) return;
    const el = shellRef.current;
    if (typeof window === 'undefined' || !el) return;
    const dims = floatDimsFromRefs();
    const r = el.getBoundingClientRect();
    const ww = r.width > 8 ? r.width : dims.w;
    const hh = r.height > 8 ? r.height : dims.h;
    const { topbar, botbar, vw, vh } = readMetrics();
    const cur = st.dockWalletPosition;
    const next = snapDockPeekCoords(cur, {
      panelW: ww,
      panelH: hh,
      viewportW: vw,
      viewportH: vh,
      topbarPx: topbar,
      bottomBarPx: botbar,
    });
    setPosition(next);
  }, [setPosition, floatDimsFromRefs]);

  useEffect(() => {
    if (!open || !trackerChainSupported || onWalletMgmtPage) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(floatingSnapOnce));
    return () => cancelAnimationFrame(id);
  }, [open, trackerChainSupported, onWalletMgmtPage, floatingSnapOnce]);

  useEffect(() => {
    if (!open || dockSnap || typeof window === 'undefined') return;
    const fn = () => floatingSnapOnce();
    window.addEventListener('resize', fn);
    return () => window.removeEventListener('resize', fn);
  }, [open, dockSnap, floatingSnapOnce]);

  function beginDragFromHeader(e: React.PointerEvent) {
    const el = shellRef.current;
    if (!el) return;
    e.preventDefault();
    transientSizeRef.current = null;
    lastFloatingLayoutRef.current = null;

    const currentSnap = useTokenDockPeekStore.getState().dockWalletDockSnap;
    if (currentSnap) {
      const r = el.getBoundingClientRect();
      setDockSnap(null);
      setPosition({ x: r.left, y: r.top });
      movePhaseRef.current = {
        pointerId: e.pointerId,
        origX: r.left,
        origY: r.top,
        startX: e.clientX,
        startY: e.clientY,
      };
    } else {
      const cur = useTokenDockPeekStore.getState().dockWalletPosition;
      movePhaseRef.current = {
        pointerId: e.pointerId,
        origX: cur.x,
        origY: cur.y,
        startX: e.clientX,
        startY: e.clientY,
      };
    }
    draggingRef.current = true;
    setDraggingUi(true);
    document.body.style.setProperty('user-select', 'none');
    el.setPointerCapture(e.pointerId);
    setDockGlow(null);
  }

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const st = useTokenDockPeekStore.getState();

      if (resizingRef.current && resizePhaseRef.current && !st.dockWalletDockSnap) {
        const rz = resizePhaseRef.current;
        if (rz.pointerId !== e.pointerId) return;

        const ox = rz.ox ?? 0;
        const oy = rz.oy ?? 0;
        const edgeX = rz.edgeX ?? 'right';
        const edgeY = rz.edgeY ?? null;
        const dx = e.clientX - rz.startX;
        const dy = e.clientY - rz.startY;
        const rightEdge = ox + rz.ow;
        const bottomEdge = oy + rz.oh;

        // Desired size — left/top edges shrink as you drag inward.
        let desiredW = rz.ow;
        let desiredH = rz.oh;
        if (edgeX === 'right') desiredW = rz.ow + dx;
        else if (edgeX === 'left') desiredW = rz.ow - dx;
        if (edgeY === 'bottom') desiredH = rz.oh + dy;
        else if (edgeY === 'top') desiredH = rz.oh - dy;

        const clamped = clampPanelSize(desiredW, desiredH);
        let newW = rz.edgeX ? clamped.w : rz.ow;
        let newH = rz.edgeY ? clamped.h : rz.oh;

        // Anchor the OPPOSITE edge: left/top drags move the panel origin.
        const m = readMetrics();
        const MIN_LEFT = 4;
        const MIN_TOP = m.topbar + 4;
        let nx = ox;
        let ny = oy;
        if (edgeX === 'left') {
          nx = rightEdge - newW;
          if (nx < MIN_LEFT) {
            nx = MIN_LEFT;
            newW = Math.max(MIN_PANEL_W, rightEdge - nx);
          }
        }
        if (edgeY === 'top') {
          ny = bottomEdge - newH;
          if (ny < MIN_TOP) {
            ny = MIN_TOP;
            newH = Math.max(MIN_PANEL_H, bottomEdge - ny);
          }
        }

        transientSizeRef.current = { w: newW, h: newH };
        if (edgeX === 'left' || edgeY === 'top') setPosition({ x: nx, y: ny });
        bumpResizeUi((x) => x + 1);
        return;
      }

      if (resizingRef.current && resizePhaseRef.current && st.dockWalletDockSnap === 'left') {
        const rz = resizePhaseRef.current;
        if (rz.pointerId !== e.pointerId) return;
        const ph = useTokenDockPeekStore.getState().dockWalletPanelSize ?? DEFAULT_WALLET_TRACKER_PEEK_SIZE;
        const nw = clampPanelSize(rz.ow + (e.clientX - rz.startX), ph.height).w;
        setPanelSize({ width: nw, height: ph.height });
        bumpResizeUi((x) => x + 1);
        return;
      }

      if (resizingRef.current && resizePhaseRef.current && st.dockWalletDockSnap === 'right') {
        const rz = resizePhaseRef.current;
        if (rz.pointerId !== e.pointerId) return;
        const ph = useTokenDockPeekStore.getState().dockWalletPanelSize ?? DEFAULT_WALLET_TRACKER_PEEK_SIZE;
        const nw = clampPanelSize(rz.ow + (rz.startX - e.clientX), ph.height).w;
        setPanelSize({ width: nw, height: ph.height });
        bumpResizeUi((x) => x + 1);
        return;
      }

      if (!draggingRef.current || !movePhaseRef.current) return;
      const ph = movePhaseRef.current;
      if (ph.pointerId !== e.pointerId) return;

      const { w: ww, h: hh } = floatDimsFromRefs();
      let nx = ph.origX + (e.clientX - ph.startX);
      let ny = ph.origY + (e.clientY - ph.startY);
      const { topbar, botbar, vw, vh } = readMetrics();
      const clamped = clampPeekTopLeftWithinViewport(
        { x: nx, y: ny },
        {
          panelW: ww,
          panelH: hh,
          viewportW: vw,
          viewportH: vh,
          topbarPx: topbar,
          bottomBarPx: botbar,
        },
      );
      nx = clamped.x;
      ny = clamped.y;
      setPosition({ x: nx, y: ny });
      movePhaseRef.current = {
        ...ph,
        origX: nx,
        origY: ny,
        startX: e.clientX,
        startY: e.clientY,
      };

      lastFloatingLayoutRef.current = { x: nx, y: ny, w: ww, h: hh };
      const m = readMetrics();
      const nextGlow = stickyDockSideFromFloatingRect({
        left: nx,
        top: ny,
        width: ww,
        height: hh,
        vw: m.vw,
        vh: m.vh,
        topbar: m.topbar,
        botbar: m.botbar,
      });
      dockGlowRef.current = nextGlow;
      setDockGlow(nextGlow);
    };

    const onUp = (e: PointerEvent) => {
      const rz = resizePhaseRef.current;

      if (resizingRef.current && rz && rz.pointerId === e.pointerId) {
        resizingRef.current = false;
        resizePhaseRef.current = null;
        const transient = transientSizeRef.current;
        try {
          shellRef.current?.releasePointerCapture(e.pointerId);
        } catch {
          //
        }
        if (transient) {
          const { w: cw, h: ch } = clampPanelSize(transient.w, transient.h);
          setPanelSize({ width: cw, height: ch });
          transientSizeRef.current = null;
        }
        document.body.style.removeProperty('user-select');
        bumpResizeUi((x) => x + 1);
        floatingSnapOnce();
        return;
      }

      const phMove = movePhaseRef.current;
      if (!draggingRef.current || !phMove || phMove.pointerId !== e.pointerId) return;

      draggingRef.current = false;
      movePhaseRef.current = null;
      setDraggingUi(false);
      try {
        shellRef.current?.releasePointerCapture(e.pointerId);
      } catch {
        //
      }
      document.body.style.removeProperty('user-select');

      const { topbar, botbar, vw, vh } = readMetrics();
      const lay = lastFloatingLayoutRef.current;
      const snapped =
        lay &&
        stickyDockSideFromFloatingRect({
          left: lay.x,
          top: lay.y,
          width: lay.w,
          height: lay.h,
          vw,
          vh,
          topbar,
          botbar,
        });

      lastFloatingLayoutRef.current = null;
      dockGlowRef.current = null;
      setDockGlow(null);

      if (snapped) {
        setDockSnap(snapped);
        return;
      }
      setDockSnap(null);
      requestAnimationFrame(() => floatingSnapOnce());
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
    };
  }, [clampPanelSize, floatDimsFromRefs, floatingSnapOnce, setDockSnap, setPanelSize, setPosition]);

  if (!open || !trackerChainSupported || onWalletMgmtPage) return null;

  void layoutEpoch;
  const { topbar, botbar, maxFloatH, dockedTopPx, copilotRightInset } = readMetrics();
  const cw = clampPanelSize(panelSize.width, panelSize.height).w;
  const ch = clampPanelSize(panelSize.width, panelSize.height).h;
  const dockedChromeTop = `${dockedTopPx}px`;
  const dockedChromeBot = DOCK_PEEK_BOTTOM_CSS;
  const floatW = transientSizeRef.current?.w ?? cw;
  const floatH = transientSizeRef.current?.h ?? Math.min(ch, maxFloatH);

  /** Start a free-float resize from any edge/corner. edgeX/edgeY say which sides move. */
  const beginResize = (
    e: React.PointerEvent<HTMLDivElement>,
    edgeX: 'left' | 'right' | null,
    edgeY: 'top' | 'bottom' | null,
  ) => {
    if (useTokenDockPeekStore.getState().dockWalletDockSnap || draggingUi) return;
    e.preventDefault();
    e.stopPropagation();
    const d = floatDimsFromRefs();
    const pos = useTokenDockPeekStore.getState().dockWalletPosition;
    resizingRef.current = true;
    resizePhaseRef.current = {
      pointerId: e.pointerId,
      ow: d.w,
      oh: d.h,
      ox: pos.x,
      oy: pos.y,
      startX: e.clientX,
      startY: e.clientY,
      axis: 'both',
      edgeX,
      edgeY,
    };
    transientSizeRef.current = { w: d.w, h: d.h };
    document.body.style.setProperty('user-select', 'none');
    shellRef.current?.setPointerCapture(e.pointerId);
  };

  return (
    <>
      {draggingUi && dockGlow === 'left' ? (
        <div
          className="pointer-events-none fixed left-0 z-[217]"
          style={{ top: dockedTopPx - 2, bottom: botbar + 6, width: EDGE_GHOST_W_PX }}
          aria-hidden
        >
          <div className="dock-peel-ghost-inner h-full rounded-r-3xl bg-gradient-to-r from-white/[0.07] via-white/[0.03] to-transparent backdrop-blur-2xl backdrop-saturate-150" />
        </div>
      ) : null}
      {draggingUi && dockGlow === 'right' ? (
        <div
          className="pointer-events-none fixed right-0 z-[217]"
          style={{ top: dockedTopPx - 2, bottom: botbar + 6, width: EDGE_GHOST_W_PX }}
          aria-hidden
        >
          <div className="dock-peel-ghost-inner h-full rounded-l-3xl bg-gradient-to-l from-white/[0.07] via-white/[0.03] to-transparent backdrop-blur-2xl backdrop-saturate-150" />
        </div>
      ) : null}

      <aside
        ref={(n) => {
          shellRef.current = n;
        }}
        className={cn(
          'fixed z-[221] flex flex-col overflow-hidden border border-border-subtle bg-bg-raised shadow-[0_20px_60px_-20px_rgba(0,0,0,0.85)] transition-[opacity] duration-200 ease-out motion-reduce:transition-none',
          dockSnap === 'left' ? 'rounded-tl-md rounded-tr-xl rounded-b-none border-b-0' : '',
          dockSnap === 'right' ? 'rounded-tr-md rounded-tl-xl rounded-b-none border-b-0' : '',
          dockSnap === null ? 'rounded-xl' : '',
          draggingUi ? 'cursor-grabbing select-none' : '',
          draggingUi && !dockSnap ? 'opacity-[0.86]' : 'opacity-100',
        )}
        style={
          dockSnap === 'left'
            ? {
                left: BODY_GUTTER_PX / 2,
                top: dockedChromeTop,
                bottom: dockedChromeBot,
                width: cw,
              }
            : dockSnap === 'right'
              ? {
                  right: BODY_GUTTER_PX / 2 + copilotRightInset,
                  top: dockedChromeTop,
                  bottom: dockedChromeBot,
                  width: cw,
                }
              : {
                  left: Math.min(position.x, Math.max(8, window.innerWidth - copilotRightInset - floatW - 8)),
                  top: position.y,
                  width: floatW,
                  height: Math.min(floatH, maxFloatH),
                  maxHeight: maxFloatH,
                }
        }
        aria-label="Tracker popup"
      >
        <header
          className={cn(
            'relative flex shrink-0 items-center gap-1 border-b border-border-subtle bg-bg-hover/40 pr-9',
            // The WHOLE toolbar is a drag handle (Axiom-style) — tabs/close still
            // click because the pointerdown guard below skips interactive targets.
            draggingUi ? 'cursor-grabbing select-none' : 'cursor-grab',
          )}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest('button, input, textarea, select, a, [data-no-drag]')) return;
            beginDragFromHeader(e);
          }}
        >
          <nav
            className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {TAB_ORDER.map((id) => (
              <button
                key={id}
                type="button"
                data-no-drag
                onClick={() => setTab(id)}
                className={cn(
                  'btn-press shrink-0 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wide transition-colors',
                  tab === id
                    ? 'bg-accent-primary/[0.2] text-fg-primary'
                    : 'text-fg-muted hover:bg-bg-hover hover:text-fg-primary',
                )}
              >
                {TAB_LABEL[id]}
              </button>
            ))}
          </nav>
          {tab === 'trades' ? (
            <div className="shrink-0 pr-1" data-no-drag>
              <WalletQuickBuyAmount />
            </div>
          ) : null}
          <div
            className="pointer-events-none relative flex h-[34px] w-9 shrink-0 items-center justify-center"
            aria-hidden
          >
            <GripDots />
          </div>
          <CloseButton
            data-no-drag
            label="Close Wallet Tracker"
            // z-30 must sit ABOVE the free-float resize handles (edges z-20, corners
            // z-[21]) — the X lives in the top-right where the top/right/tr handles all
            // converge, so at a lower z they'd swallow the click (panel resizes instead
            // of closing) while the button still shows its hover state. Keep this above 21.
            className="absolute right-1 top-1/2 z-30 -translate-y-1/2"
            onClick={() => setOpen(false)}
          />
        </header>

        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col',
            tab === 'trades' || tab === 'groups' || tab === 'kols' ? 'overflow-hidden' : 'gap-3 overflow-auto px-3 py-3',
          )}
          style={{ minHeight: 220 }}
        >
          {tab === 'trades' ? (
            // Undocked (free-floating) → zebra striping instead of green/red row fills (Axiom).
            <TrackerTradesFeed zebra={dockSnap === null} />
          ) : tab === 'groups' ? (
            <GroupsTab />
          ) : (
            <WalletTrackerKolsTab />
          )}
        </div>

        {/* Tester toasts are a dev tool — never shown to founders/production users. */}
        {process.env.NODE_ENV === 'development' ? (
          <footer className="flex shrink-0 items-start gap-2 border-t border-rose-500/15 bg-gradient-to-r from-rose-500/[0.07] via-transparent px-3 py-2">
            <div className="min-w-0 flex-1 pb-px">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-rose-200/95">Tester</p>
              <p className="text-[9px] leading-snug text-fg-muted">Fires the wallet-tracker toast channel.</p>
            </div>
            <div className="flex shrink-0 flex-col gap-1">
              <button
                type="button"
                data-no-drag
                onClick={() => toastWalletTrackedTradeDemo('buy')}
                className="btn-press inline-flex items-center gap-1.5 rounded-md border border-rose-400/35 bg-rose-500/12 px-2.5 py-1.5 text-[10px] font-bold text-rose-100 shadow-sm transition hover:bg-rose-500/20"
              >
                <BellRing className="h-3.5 w-3.5" strokeWidth={2} />
                Demo buy toast
              </button>
              <button
                type="button"
                data-no-drag
                onClick={() => toastWalletTrackedTradeDemo('sell')}
                className="btn-press rounded-md border border-white/[0.08] bg-bg-sunken/40 px-2 py-1 text-[9px] font-semibold text-fg-secondary hover:bg-bg-hover"
              >
                Demo sell toast
              </button>
            </div>
          </footer>
        ) : null}

        {!dockSnap ? (
          <>
            {/* Edges — all four sides resize (left/top anchor the opposite edge). */}
            <EdgeResizeHandle side="right" draggingUi={draggingUi} onPointerDown={(e) => beginResize(e, 'right', null)} />
            <EdgeResizeHandle side="left" draggingUi={draggingUi} onPointerDown={(e) => beginResize(e, 'left', null)} />
            <EdgeResizeHandle side="bottom" draggingUi={draggingUi} onPointerDown={(e) => beginResize(e, null, 'bottom')} />
            <EdgeResizeHandle side="top" draggingUi={draggingUi} onPointerDown={(e) => beginResize(e, null, 'top')} />
            {/* Corners — diagonal from every corner. */}
            <CornerResizeHandle corner="br" draggingUi={draggingUi} onPointerDown={(e) => beginResize(e, 'right', 'bottom')} />
            <CornerResizeHandle corner="bl" draggingUi={draggingUi} onPointerDown={(e) => beginResize(e, 'left', 'bottom')} />
            <CornerResizeHandle corner="tr" draggingUi={draggingUi} onPointerDown={(e) => beginResize(e, 'right', 'top')} />
            <CornerResizeHandle corner="tl" draggingUi={draggingUi} onPointerDown={(e) => beginResize(e, 'left', 'top')} />
          </>
        ) : (
          <DockPeekWidthHandle
            edge={dockSnap === 'left' ? 'right' : 'left'}
            draggingUi={draggingUi}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const el = shellRef.current;
              const side = useTokenDockPeekStore.getState().dockWalletDockSnap;
              if (!el || !side) return;
              const r = el.getBoundingClientRect();
              resizingRef.current = true;
              resizePhaseRef.current = {
                pointerId: e.pointerId,
                ow: r.width,
                oh: panelSize.height,
                startX: e.clientX,
                startY: e.clientY,
                axis: 'ew',
              };
              document.body.style.setProperty('user-select', 'none');
              shellRef.current?.setPointerCapture(e.pointerId);
            }}
          />
        )}
      </aside>
    </>
  );
}

/**
 * Groups tab — replaces the redundant "Monitor" tab (X monitor is its own thing
 * on Pulse). Create/organise wallet groups and click one to switch the active
 * instant-trade wallets to that group. Wallet assignment needs the wallet list.
 */
function GroupsTab() {
  const { authenticated, getAccessToken } = usePointerAuth();
  const activeGroupId = useWalletGroupsStore((s) => s.activeGroupId);
  const groups = useWalletGroupsStore((s) => s.groups);
  const setActiveGroupId = useWalletGroupsStore((s) => s.setActiveGroupId);
  const touchGroup = useWalletGroupsStore((s) => s.touchGroup);
  const setShortlist = useTradingStore((s) => s.setInstantTradeWalletShortlist);
  const clearShortlist = useTradingStore((s) => s.clearInstantTradeWalletShortlist);

  const walletsQ = useQuery({
    queryKey: ['wallets-my'],
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      const res = await fetch('/api/wallets/my', { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error('wallets');
      return res.json() as Promise<{ wallets: MyWalletRow[] }>;
    },
    enabled: authenticated,
    staleTime: 30_000,
  });

  const onSelectGroup = (id: string | null) => {
    if (!id || id === UNGROUPED_GROUP_ID) {
      setActiveGroupId(null);
      clearShortlist();
      return;
    }
    setActiveGroupId(id);
    touchGroup(id);
    const g = groups.find((x) => x.id === id);
    setShortlist(g?.walletAddresses ?? []);
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto [-ms-overflow-style:none] [scrollbar-width:thin]">
      <WalletGroupsSidebar
        wallets={walletsQ.data?.wallets ?? []}
        selectedGroupId={activeGroupId}
        onSelectGroup={onSelectGroup}
        className="px-2 py-2"
      />
    </div>
  );
}
