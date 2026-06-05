'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  clampPeekTopLeftWithinViewport,
  DOCK_PEEK_BOTTOM_CSS,
  readDockPeekTopPx,
  readLayoutChromePx,
  snapDockPeekCoords,
} from '@/lib/layout/dockPeekSnap';
import { stickyDockSideFromFloatingRect } from '@/lib/layout/floatingPeekSticky';
import { embedXMonitorOnPulse } from '@/lib/xMonitor/openXMonitorFloat';
import { closeXMonitor } from '@/lib/xMonitor/openXMonitorOnPulse';
import {
  clampDockPeekWidth,
  DEFAULT_X_MONITOR_PEEK_SIZE,
  useTokenDockPeekStore,
  type PeekDockSnapSide,
} from '@/store/tokenDockPeek';
import { useUIStore } from '@/store/ui';
import { cn } from '@/lib/utils/cn';
import { XMonitorPanel } from '@/components/monitor/XMonitorPanel';

const MIN_PANEL_W = 320;
const MIN_PANEL_H = 360;
const EDGE_GHOST_W_PX = 72;
const BODY_GUTTER_PX = 10;
const BODY_GUTTER_EXTRA_PX = 10;

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

/** Draggable / edge-dockable X monitor — detach from Pulse side rail via header grabber. */
export function DockXMonitorFloatingPanel() {
  const pathname = usePathname();
  const onPulse = pathname?.startsWith('/pulse') ?? false;
  const activeChain = useUIStore((s) => s.activeChain);

  const open = useTokenDockPeekStore((s) => s.xMonitorPeekOpen);
  const setOpen = useTokenDockPeekStore((s) => s.setXMonitorPeekOpen);
  const position = useTokenDockPeekStore((s) => s.dockXMonitorPosition);
  const setPosition = useTokenDockPeekStore((s) => s.setDockXMonitorPosition);
  const dockSnap = useTokenDockPeekStore((s) => s.dockXMonitorDockSnap);
  const setDockSnap = useTokenDockPeekStore((s) => s.setXMonitorDockSnap);
  const panelSize = useTokenDockPeekStore((s) => s.dockXMonitorPanelSize ?? DEFAULT_X_MONITOR_PEEK_SIZE);
  const setPanelSize = useTokenDockPeekStore((s) => s.setXMonitorPanelSize);

  const shellRef = useRef<HTMLElement | null>(null);
  const draggingRef = useRef(false);
  const resizingRef = useRef(false);
  const transientSizeRef = useRef<{ w: number; h: number } | null>(null);

  type MovePhase = { pointerId: number; origX: number; origY: number; startX: number; startY: number };
  const movePhaseRef = useRef<MovePhase | null>(null);

  type ResizePhase = { pointerId: number; ow: number; oh: number; startX: number; startY: number };
  const resizePhaseRef = useRef<ResizePhase | null>(null);

  const [draggingUi, setDraggingUi] = useState(false);
  const [dockGlow, setDockGlow] = useState<null | 'left' | 'right'>(null);
  const dockGlowRef = useRef(dockGlow);
  dockGlowRef.current = dockGlow;
  const lastFloatingLayoutRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const [, bumpResizeUi] = useState(0);
  const [layoutEpoch, bumpLayoutEpoch] = useState(0);

  useEffect(() => {
    if (activeChain !== 'sol' && open) setOpen(false);
  }, [activeChain, open, setOpen]);

  const readMetrics = () => {
    const { topbar, botbar } = readLayoutChromePx();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    const dockTopPx = readDockPeekTopPx(onPulse);
    const maxFloatH = Math.max(MIN_PANEL_H, vh - dockTopPx - botbar - 12);
    const maxFloatW = Math.max(MIN_PANEL_W, vw - 24);
    return { topbar, botbar, vw, vh, maxFloatH, maxFloatW, dockTopPx };
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
    const sz = st.dockXMonitorPanelSize ?? DEFAULT_X_MONITOR_PEEK_SIZE;
    const t = transientSizeRef.current;
    if (t) return clampPanelSize(t.w, t.h);
    return clampPanelSize(sz.width, sz.height);
  }, [clampPanelSize]);

  const applyBodyPadForDock = useCallback(
    (side: PeekDockSnapSide, widthPx: number) => {
      if (typeof document === 'undefined') return;
      if (!side) {
        document.documentElement.style.setProperty('--x-monitor-dock-pad-left', '0px');
        document.documentElement.style.setProperty('--x-monitor-dock-pad-right', '0px');
        return;
      }
      const w = clampPanelSize(widthPx, MIN_PANEL_H).w;
      const pad = `${w + BODY_GUTTER_EXTRA_PX}px`;
      if (side === 'left') {
        document.documentElement.style.setProperty('--x-monitor-dock-pad-left', pad);
        document.documentElement.style.setProperty('--x-monitor-dock-pad-right', '0px');
      } else {
        document.documentElement.style.setProperty('--x-monitor-dock-pad-left', '0px');
        document.documentElement.style.setProperty('--x-monitor-dock-pad-right', pad);
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
      document.documentElement.style.setProperty('--x-monitor-dock-pad-left', '0px');
      document.documentElement.style.setProperty('--x-monitor-dock-pad-right', '0px');
    };
  }, [open, dockSnap, panelSize.width, applyBodyPadForDock]);

  const floatingSnapOnce = useCallback(() => {
    const st = useTokenDockPeekStore.getState();
    if (st.dockXMonitorDockSnap) return;
    const el = shellRef.current;
    if (typeof window === 'undefined' || !el) return;
    const dims = floatDimsFromRefs();
    const r = el.getBoundingClientRect();
    const ww = r.width > 8 ? r.width : dims.w;
    const hh = r.height > 8 ? r.height : dims.h;
    const { topbar, botbar, vw, vh } = readMetrics();
    const cur = st.dockXMonitorPosition;
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
    if (!open || activeChain !== 'sol') return;
    const id = requestAnimationFrame(() => requestAnimationFrame(floatingSnapOnce));
    return () => cancelAnimationFrame(id);
  }, [open, activeChain, floatingSnapOnce]);

  function beginDragFromHeader(e: React.PointerEvent) {
    const el = shellRef.current;
    if (!el) return;
    e.preventDefault();
    transientSizeRef.current = null;
    lastFloatingLayoutRef.current = null;

    const currentSnap = useTokenDockPeekStore.getState().dockXMonitorDockSnap;
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
      const cur = useTokenDockPeekStore.getState().dockXMonitorPosition;
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

      if (resizingRef.current && resizePhaseRef.current && !st.dockXMonitorDockSnap) {
        const rz = resizePhaseRef.current;
        if (rz.pointerId !== e.pointerId) return;
        const nw = rz.ow + (e.clientX - rz.startX);
        const nh = rz.oh + (e.clientY - rz.startY);
        const { w: cw, h: ch } = clampPanelSize(nw, nh);
        transientSizeRef.current = { w: cw, h: ch };
        bumpResizeUi((x) => x + 1);
        return;
      }

      if (resizingRef.current && resizePhaseRef.current && st.dockXMonitorDockSnap === 'left') {
        const rz = resizePhaseRef.current;
        if (rz.pointerId !== e.pointerId) return;
        const ph = useTokenDockPeekStore.getState().dockXMonitorPanelSize ?? DEFAULT_X_MONITOR_PEEK_SIZE;
        const nw = clampPanelSize(rz.ow + (e.clientX - rz.startX), ph.height).w;
        setPanelSize({ width: nw, height: ph.height });
        bumpResizeUi((x) => x + 1);
        return;
      }

      if (resizingRef.current && resizePhaseRef.current && st.dockXMonitorDockSnap === 'right') {
        const rz = resizePhaseRef.current;
        if (rz.pointerId !== e.pointerId) return;
        const ph = useTokenDockPeekStore.getState().dockXMonitorPanelSize ?? DEFAULT_X_MONITOR_PEEK_SIZE;
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
          /* ignore */
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
        /* ignore */
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
        if (onPulse) {
          embedXMonitorOnPulse(snapped);
          return;
        }
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
  }, [clampPanelSize, floatDimsFromRefs, floatingSnapOnce, onPulse, setDockSnap, setPanelSize, setPosition]);

  if (!open || activeChain !== 'sol') return null;

  void layoutEpoch;
  const { topbar, botbar, maxFloatH, dockTopPx } = readMetrics();
  const cw = clampPanelSize(panelSize.width, panelSize.height).w;
  const ch = clampPanelSize(panelSize.width, panelSize.height).h;
  const dockedChromeTop = `${dockTopPx}px`;
  const dockedChromeBot = DOCK_PEEK_BOTTOM_CSS;
  const floatW = transientSizeRef.current?.w ?? cw;
  const floatH = transientSizeRef.current?.h ?? Math.min(ch, maxFloatH);

  return (
    <>
      {draggingUi && dockGlow === 'left' ? (
        <div
          className="pointer-events-none fixed left-0 z-[217]"
          style={{ top: dockTopPx - 2, bottom: botbar + 6, width: EDGE_GHOST_W_PX }}
          aria-hidden
        >
          <div className="dock-peel-ghost-inner h-full rounded-r-3xl bg-gradient-to-r from-white/[0.07] via-white/[0.03] to-transparent backdrop-blur-2xl backdrop-saturate-150" />
        </div>
      ) : null}
      {draggingUi && dockGlow === 'right' ? (
        <div
          className="pointer-events-none fixed right-0 z-[217]"
          style={{ top: dockTopPx - 2, bottom: botbar + 6, width: EDGE_GHOST_W_PX }}
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
          dockSnap === null ? 'rounded-md' : '',
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
        aria-label="X monitor"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <XMonitorPanel
            embedded
            draggable
            floating
            onDragHandlePointerDown={beginDragFromHeader}
            onClose={() => closeXMonitor()}
          />
        </div>

        {!dockSnap ? (
          <div
            role="separator"
            className={cn(
              'absolute bottom-0 right-0 z-[5] cursor-nwse-resize rounded-tl-md',
              draggingUi ? 'pointer-events-none' : '',
            )}
            style={{ touchAction: 'none', width: 20, height: 20 }}
            onPointerDown={(e) => {
              if (useTokenDockPeekStore.getState().dockXMonitorDockSnap || draggingUi) return;
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
              };
              transientSizeRef.current = { w: d.w, h: d.h };
              document.body.style.setProperty('user-select', 'none');
              shellRef.current?.setPointerCapture(e.pointerId);
            }}
          >
            <span className="sr-only">Resize X monitor</span>
          </div>
        ) : (
          <div
            className={cn(
              'absolute top-[24%] bottom-[24%] z-[5] cursor-ew-resize',
              draggingUi ? 'pointer-events-none' : '',
              dockSnap === 'left' ? 'right-0 w-[10px]' : 'left-0 w-[10px]',
            )}
            style={{ touchAction: 'none' }}
            onPointerDown={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const el = shellRef.current;
              const side = useTokenDockPeekStore.getState().dockXMonitorDockSnap;
              if (!el || !side) return;
              const r = el.getBoundingClientRect();
              resizingRef.current = true;
              resizePhaseRef.current = {
                pointerId: e.pointerId,
                ow: r.width,
                oh: panelSize.height,
                startX: e.clientX,
                startY: e.clientY,
              };
              document.body.style.setProperty('user-select', 'none');
              shellRef.current?.setPointerCapture(e.pointerId);
            }}
          >
            <span className="sr-only">Resize docked X monitor width</span>
          </div>
        )}
      </aside>
    </>
  );
}
