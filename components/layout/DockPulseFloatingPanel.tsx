'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import { X } from 'lucide-react';
import { PulseColumn } from '@/components/tokens/PulseColumn';
import {
  clampPeekTopLeftWithinViewport,
  DOCK_PEEK_BOTTOM_CSS,
  readDockPeekTopPx,
  readLayoutChromePx,
  snapDockPeekCoords,
} from '@/lib/layout/dockPeekSnap';
import { stickyDockSideFromFloatingRect } from '@/lib/layout/floatingPeekSticky';
import {
  clampDockPeekWidth,
  DEFAULT_PULSE_PEEK_SIZE,
  type PulseDockSnapSide,
  useTokenDockPeekStore,
} from '@/store/tokenDockPeek';
import { useUIStore } from '@/store/ui';
import type { PulseColumnId } from '@/lib/utils/constants';
import { cn } from '@/lib/utils/cn';

const TAB_LABEL: Record<PulseColumnId, string> = {
  new: 'New',
  stretch: 'Stretch',
  migrated: 'Migrated',
};
const TAB_ORDER: PulseColumnId[] = ['new', 'stretch', 'migrated'];

const MIN_PANEL_W = 320;
const MIN_PANEL_H = 420;
/** Edge-ghost overlay width near screen bezel while dragging */
const EDGE_GHOST_W_PX = 72;
const BODY_GUTTER_PX = 10;
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

/** Non-modal Pulse peek: sizeable float + Co-pilot style dock + edge blur cue */
export function DockPulseFloatingPanel() {
  const pathname = usePathname();
  const activeChain = useUIStore((s) => s.activeChain);
  const open = useTokenDockPeekStore((s) => s.pulsePeekOpen);
  const setOpen = useTokenDockPeekStore((s) => s.setPulsePeekOpen);
  const tab = useTokenDockPeekStore((s) => s.dockPulseTab);
  const setTab = useTokenDockPeekStore((s) => s.setDockPulseTab);
  const position = useTokenDockPeekStore((s) => s.dockPulsePosition);
  const setPosition = useTokenDockPeekStore((s) => s.setDockPulsePosition);
  const dockSnap = useTokenDockPeekStore((s) => s.dockPulseDockSnap);
  const setDockSnap = useTokenDockPeekStore((s) => s.setPulseDockSnap);
  const panelSize = useTokenDockPeekStore((s) => s.dockPulsePanelSize ?? DEFAULT_PULSE_PEEK_SIZE);
  const setPanelSize = useTokenDockPeekStore((s) => s.setPulsePanelSize);

  const onPulsePage = pathname?.startsWith('/pulse') ?? false;

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

  useEffect(() => {
    if (onPulsePage && open) setOpen(false);
  }, [onPulsePage, open, setOpen]);

  useEffect(() => {
    if (activeChain !== 'sol' && open) setOpen(false);
  }, [activeChain, open, setOpen]);

  const readMetrics = () => {
    const { topbar, botbar } = readLayoutChromePx();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    const dockTopPx = readDockPeekTopPx(false);
    const maxFloatH = Math.max(MIN_PANEL_H, vh - dockTopPx - botbar - 12);
    const maxFloatW = Math.max(MIN_PANEL_W, vw - 24);
    return { topbar, botbar, vw, vh, maxFloatH, maxFloatW, dockTopPx };
  };

  const clampPanelSize = useCallback((w: number, h: number) => {
    const { maxFloatH } = readMetrics();
    return {
      w: clampDockPeekWidth(w, MIN_PANEL_W),
      h: Math.round(Math.min(maxFloatH, Math.max(MIN_PANEL_H, h))),
    };
  }, []);

  const floatDimsFromRefs = useCallback((): { w: number; h: number } => {
    const st = useTokenDockPeekStore.getState();
    const sz = st.dockPulsePanelSize ?? DEFAULT_PULSE_PEEK_SIZE;
    const t = transientSizeRef.current;
    if (t) return clampPanelSize(t.w, t.h);
    return clampPanelSize(sz.width, sz.height);
  }, [clampPanelSize]);

  const applyBodyPadForDock = useCallback(
    (side: PulseDockSnapSide, widthPx: number) => {
      if (typeof document === 'undefined') return;
      if (!side) {
        document.documentElement.style.setProperty('--pulse-dock-pad-left', '0px');
        document.documentElement.style.setProperty('--pulse-dock-pad-right', '0px');
        return;
      }
      const w = clampPanelSize(widthPx, MIN_PANEL_H).w;
      const pad = `${w + BODY_GUTTER_PX}px`;
      if (side === 'left') {
        document.documentElement.style.setProperty('--pulse-dock-pad-left', pad);
        document.documentElement.style.setProperty('--pulse-dock-pad-right', '0px');
      } else {
        document.documentElement.style.setProperty('--pulse-dock-pad-left', '0px');
        document.documentElement.style.setProperty('--pulse-dock-pad-right', pad);
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
      document.documentElement.style.setProperty('--pulse-dock-pad-left', '0px');
      document.documentElement.style.setProperty('--pulse-dock-pad-right', '0px');
    };
  }, [open, dockSnap, panelSize.width, applyBodyPadForDock]);

  const floatingSnapOnce = useCallback(() => {
    const st = useTokenDockPeekStore.getState();
    if (st.dockPulseDockSnap) return;
    const el = shellRef.current;
    if (typeof window === 'undefined' || !el) return;
    const dims = floatDimsFromRefs();
    const r = el.getBoundingClientRect();
    const ww = r.width > 8 ? r.width : dims.w;
    const hh = r.height > 8 ? r.height : dims.h;
    const { topbar, botbar, vw, vh } = readMetrics();
    const cur = st.dockPulsePosition;
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
    if (!open || activeChain !== 'sol' || onPulsePage) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(floatingSnapOnce));
    return () => cancelAnimationFrame(id);
  }, [open, activeChain, onPulsePage, floatingSnapOnce]);

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

    const currentSnap = useTokenDockPeekStore.getState().dockPulseDockSnap;
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
      const cur = useTokenDockPeekStore.getState().dockPulsePosition;
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

  /** Global pointer routing — avoids stale closures from changing dock/float modes */
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const st = useTokenDockPeekStore.getState();

      /* Float corner resize */
      if (resizingRef.current && resizePhaseRef.current && !st.dockPulseDockSnap) {
        const rz = resizePhaseRef.current;
        if (rz.pointerId !== e.pointerId) return;
        const nw = rz.ow + (e.clientX - rz.startX);
        const nh = rz.oh + (e.clientY - rz.startY);
        const { w: cw, h: ch } = clampPanelSize(nw, nh);
        transientSizeRef.current = { w: cw, h: ch };
        bumpResizeUi((x) => x + 1);
        return;
      }

      /* Docked rail — width only */
      if (resizingRef.current && resizePhaseRef.current && st.dockPulseDockSnap === 'left') {
        const rz = resizePhaseRef.current;
        if (rz.pointerId !== e.pointerId) return;
        const ph = useTokenDockPeekStore.getState().dockPulsePanelSize ?? DEFAULT_PULSE_PEEK_SIZE;
        const nw = clampPanelSize(rz.ow + (e.clientX - rz.startX), ph.height).w;
        setPanelSize({ width: nw, height: ph.height });
        bumpResizeUi((x) => x + 1);
        return;
      }

      if (resizingRef.current && resizePhaseRef.current && st.dockPulseDockSnap === 'right') {
        const rz = resizePhaseRef.current;
        if (rz.pointerId !== e.pointerId) return;
        const ph = useTokenDockPeekStore.getState().dockPulsePanelSize ?? DEFAULT_PULSE_PEEK_SIZE;
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

      /* End resize float */
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
  }, [
    clampPanelSize,
    floatDimsFromRefs,
    floatingSnapOnce,
    setDockSnap,
    setPanelSize,
    setPosition,
  ]);

  if (!open || activeChain !== 'sol' || onPulsePage) return null;

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
          className="pointer-events-none fixed left-0 z-[218]"
          style={{ top: dockTopPx - 2, bottom: botbar + 6, width: EDGE_GHOST_W_PX }}
          aria-hidden
        >
          <div className="dock-peel-ghost-inner h-full rounded-r-3xl bg-gradient-to-r from-white/[0.07] via-white/[0.03] to-transparent backdrop-blur-2xl backdrop-saturate-150" />
        </div>
      ) : null}
      {draggingUi && dockGlow === 'right' ? (
        <div
          className="pointer-events-none fixed right-0 z-[218]"
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
          'fixed z-[220] flex flex-col overflow-hidden border border-border-subtle bg-bg-raised shadow-[0_20px_60px_-20px_rgba(0,0,0,0.85)] transition-[opacity,outline] duration-200 ease-out motion-reduce:transition-none',
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
        aria-label="Pulse feed popup"
      >
        <header className={cn('flex shrink-0 items-stretch gap-1 border-b border-border-subtle bg-bg-hover/40')}>
          <nav
            className="flex min-w-0 shrink-0 items-center gap-0.5 overflow-x-auto px-1.5 py-1"
            data-no-drag
            onPointerDown={(e) => e.stopPropagation()}
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
            role="presentation"
            className={cn(
              'relative flex min-h-[34px] min-w-[3rem] flex-1 cursor-grab items-center justify-center active:cursor-grabbing',
              draggingUi ? 'bg-white/[0.02]' : '',
            )}
            onPointerDown={(e) => {
              if ((e.target as HTMLElement).closest('button, input, textarea, select, [data-no-drag]')) return;
              beginDragFromHeader(e);
            }}
          >
            <GripDots />
          </div>

          <div className="flex shrink-0 items-center px-1" data-no-drag onPointerDown={(e) => e.stopPropagation()}>
            <button
              type="button"
              data-no-drag
              aria-label="Close Pulse"
              className="rounded-md p-1.5 text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
              onClick={() => setOpen(false)}
            >
              <X className="h-3.5 w-3.5" strokeWidth={2} />
            </button>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-px pb-px pt-1">
          <PulseColumn column={tab} initialShare={null} />
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
              if (useTokenDockPeekStore.getState().dockPulseDockSnap || draggingUi) return;
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
            <span className="sr-only">Resize Pulse panel</span>
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
              const side = useTokenDockPeekStore.getState().dockPulseDockSnap;
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
            <span className="sr-only">Resize Pulse dock width</span>
          </div>
        )}
      </aside>
    </>
  );
}
