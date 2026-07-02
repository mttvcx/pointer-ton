'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BellRing, ChevronRight, X } from 'lucide-react';
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
import { openXMonitorOnPulse } from '@/lib/xMonitor/openXMonitorOnPulse';
import { toastWalletTrackedTradeDemo } from '@/lib/walletTracker/walletTrackerToast';

type WalletTrackerTab = 'manager' | 'trades' | 'monitor' | 'kols';

const TAB_LABEL: Record<WalletTrackerTab, string> = {
  manager: 'Manager',
  trades: 'Trades',
  monitor: 'Monitor',
  kols: 'KOLs',
};
const TAB_ORDER: WalletTrackerTab[] = ['manager', 'trades', 'monitor', 'kols'];

const MIN_PANEL_W = 300;
const MIN_PANEL_H = 300;
const EDGE_GHOST_W_PX = 72;
const BODY_GUTTER_PX = 10;
const BODY_GUTTER_EXTRA_PX = 10;

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
  const open = useTokenDockPeekStore((s) => s.walletPeekOpen);
  const setOpen = useTokenDockPeekStore((s) => s.setWalletPeekOpen);
  const position = useTokenDockPeekStore((s) => s.dockWalletPosition);
  const setPosition = useTokenDockPeekStore((s) => s.setDockWalletPosition);
  const dockSnap = useTokenDockPeekStore((s) => s.dockWalletDockSnap);
  const setDockSnap = useTokenDockPeekStore((s) => s.setWalletDockSnap);
  const panelSize = useTokenDockPeekStore((s) => s.dockWalletPanelSize ?? DEFAULT_WALLET_TRACKER_PEEK_SIZE);
  const setPanelSize = useTokenDockPeekStore((s) => s.setWalletPanelSize);

  const [tab, setTab] = useState<WalletTrackerTab>(() =>
    pathname?.startsWith('/pulse') ? 'monitor' : 'trades',
  );

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
    axis: 'both' | 'ew';
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

  useEffect(() => {
    if (activeChain !== 'sol' && open) setOpen(false);
  }, [activeChain, open, setOpen]);

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
    return { topbar, botbar, vw, vh, maxFloatH, maxFloatW, dockTopPx, dockedTopPx };
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
    if (!open || activeChain !== 'sol' || onWalletMgmtPage) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(floatingSnapOnce));
    return () => cancelAnimationFrame(id);
  }, [open, activeChain, onWalletMgmtPage, floatingSnapOnce]);

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
        const nw = rz.ow + (e.clientX - rz.startX);
        if (rz.axis === 'ew') {
          const { w: cw } = clampPanelSize(nw, rz.oh);
          transientSizeRef.current = { w: cw, h: rz.oh };
        } else {
          const nh = rz.oh + (e.clientY - rz.startY);
          const { w: cw, h: ch } = clampPanelSize(nw, nh);
          transientSizeRef.current = { w: cw, h: ch };
        }
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

  if (!open || activeChain !== 'sol' || onWalletMgmtPage) return null;

  void layoutEpoch;
  const { topbar, botbar, maxFloatH, dockedTopPx } = readMetrics();
  const cw = clampPanelSize(panelSize.width, panelSize.height).w;
  const ch = clampPanelSize(panelSize.width, panelSize.height).h;
  const dockedChromeTop = `${dockedTopPx}px`;
  const dockedChromeBot = DOCK_PEEK_BOTTOM_CSS;
  const floatW = transientSizeRef.current?.w ?? cw;
  const floatH = transientSizeRef.current?.h ?? Math.min(ch, maxFloatH);

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
                  right: BODY_GUTTER_PX / 2,
                  top: dockedChromeTop,
                  bottom: dockedChromeBot,
                  width: cw,
                }
              : {
                  left: position.x,
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
          <div
            className="pointer-events-none relative flex h-[34px] w-9 shrink-0 items-center justify-center"
            aria-hidden
          >
            <GripDots />
          </div>
          <button
            type="button"
            data-no-drag
            aria-label="Close Wallet Tracker"
            className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded-md border border-white/[0.08] bg-bg-base/80 p-1.5 text-fg-secondary hover:border-white/[0.14] hover:bg-bg-hover hover:text-fg-primary"
            onClick={() => setOpen(false)}
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </header>

        <div
          className={cn(
            'flex min-h-0 flex-1 flex-col',
            tab === 'monitor' ? 'overflow-hidden' : 'gap-3 overflow-auto px-3 py-3',
          )}
          style={{ minHeight: tab === 'monitor' ? 280 : 220 }}
        >
          {tab === 'trades' ? (
            <>
              <p className="px-3 pt-3 text-[11px] leading-relaxed text-fg-secondary">
                Live buys / sells land as <strong className="text-fg-primary">top pings</strong> when you&apos;re tracking
                wallets. Open Track for the full grid — this peek shares Pulse-style edge docking.
              </p>
              <Link
                href="/track"
                data-no-drag
                className="inline-flex items-center gap-1 px-3 pb-3 text-[11px] font-semibold text-accent-primary hover:brightness-125"
                onClick={() => setOpen(false)}
              >
                Open Track workspace
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </Link>
            </>
          ) : tab === 'monitor' ? (
            <div className="flex flex-col gap-3 px-3 py-3">
              <p className="text-[11px] leading-relaxed text-fg-secondary">
                X monitor lives on <strong className="text-fg-primary">Pulse</strong> — full-height side rail with
                feed, rules, and AI deploy.
              </p>
              <button
                type="button"
                data-no-drag
                className="btn-press inline-flex w-fit items-center gap-1 rounded-sm border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5 text-[11px] font-semibold text-accent-primary hover:bg-white/[0.08]"
                onClick={() => {
                  setOpen(false);
                  openXMonitorOnPulse('left');
                }}
              >
                Open X monitor on Pulse
                <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} />
              </button>
            </div>
          ) : (
            <p className="px-3 py-3 text-[11px] leading-relaxed text-fg-secondary">
              <strong className="text-fg-primary">{TAB_LABEL[tab]}</strong> plugs into the tracker pipeline next — use{' '}
              <Link href="/track" className="font-semibold text-accent-primary underline-offset-2 hover:underline">
                Track
              </Link>{' '}
              for now.
            </p>
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
            <DockPeekWidthHandle
              edge="right"
              draggingUi={draggingUi}
              onPointerDown={(e) => {
                if (draggingUi) return;
                e.preventDefault();
                e.stopPropagation();
                const d = floatDimsFromRefs();
                resizingRef.current = true;
                resizePhaseRef.current = {
                  pointerId: e.pointerId,
                  ow: d.w,
                  oh: d.h,
                  startX: e.clientX,
                  startY: e.clientY,
                  axis: 'ew',
                };
                transientSizeRef.current = { w: d.w, h: d.h };
                document.body.style.setProperty('user-select', 'none');
                shellRef.current?.setPointerCapture(e.pointerId);
              }}
            />
            <div
              role="separator"
              className={cn(
                'absolute bottom-0 right-0 z-[5] cursor-nwse-resize rounded-tl-md',
                draggingUi ? 'pointer-events-none' : '',
              )}
              style={{ touchAction: 'none', width: 20, height: 20 }}
              onPointerDown={(e) => {
                if (useTokenDockPeekStore.getState().dockWalletDockSnap || draggingUi) return;
                e.preventDefault();
                e.stopPropagation();
                const d = floatDimsFromRefs();
                resizingRef.current = true;
                resizePhaseRef.current = {
                  pointerId: e.pointerId,
                  ow: d.w,
                  oh: d.h,
                  startX: e.clientX,
                  startY: e.clientY,
                  axis: 'both',
                };
                transientSizeRef.current = { w: d.w, h: d.h };
                document.body.style.setProperty('user-select', 'none');
                shellRef.current?.setPointerCapture(e.pointerId);
              }}
            >
              <span className="sr-only">Resize Tracker panel</span>
            </div>
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
