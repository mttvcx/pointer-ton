'use client';

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { usePathname } from 'next/navigation';
import {
  clampPeekTopLeftWithinViewport,
  DOCK_PEEK_BOTTOM_CSS,
  readDockPeekTopPx,
  readLayoutChromePx,
  snapDockPeekCoords,
} from '@/lib/layout/dockPeekSnap';
import { stickyDockSideFromFloatingRect } from '@/lib/layout/floatingPeekSticky';
import { consumeSquadsPeelDrag, embedSquadsOnPulse } from '@/lib/squads/openSquadsFloat';
import {
  clampDockPeekWidth,
  DEFAULT_SQUADS_PEEK_SIZE,
  useTokenDockPeekStore,
  type PeekDockSnapSide,
} from '@/store/tokenDockPeek';
import { cn } from '@/lib/utils/cn';
import { SquadsAsidePanel } from '@/components/squads/SquadsAsidePanel';

const MIN_PANEL_W = 300;
const MIN_PANEL_H = 280;
const MAX_FLOAT_PANEL_H = 560;
const EDGE_GHOST_W_PX = 72;
const BODY_GUTTER_PX = 10;
const BODY_GUTTER_EXTRA_PX = 10;

/** Draggable / edge-dockable squads chat — mirrors X monitor float behavior. */
export function DockSquadsFloatingPanel() {
  const pathname = usePathname();
  const onPulse = pathname?.startsWith('/pulse') ?? false;

  const open = useTokenDockPeekStore((s) => s.squadsPeekOpen);
  const setOpen = useTokenDockPeekStore((s) => s.setSquadsPeekOpen);
  const position = useTokenDockPeekStore((s) => s.dockSquadsPosition);
  const setPosition = useTokenDockPeekStore((s) => s.setDockSquadsPosition);
  const dockSnap = useTokenDockPeekStore((s) => s.dockSquadsDockSnap);
  const setDockSnap = useTokenDockPeekStore((s) => s.setSquadsDockSnap);
  const panelSize = useTokenDockPeekStore((s) => s.dockSquadsPanelSize ?? DEFAULT_SQUADS_PEEK_SIZE);
  const setPanelSize = useTokenDockPeekStore((s) => s.setSquadsPanelSize);

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
    mode: 'corner' | 'bottom' | 'right';
  };
  const resizePhaseRef = useRef<ResizePhase | null>(null);

  const [draggingUi, setDraggingUi] = useState(false);
  const [dockGlow, setDockGlow] = useState<null | 'left' | 'right'>(null);
  const dockGlowRef = useRef(dockGlow);
  dockGlowRef.current = dockGlow;
  const lastFloatingLayoutRef = useRef<{ x: number; y: number; w: number; h: number } | null>(null);
  const skipNextFloatingSnapRef = useRef(false);
  const [, bumpResizeUi] = useState(0);
  const [layoutEpoch, bumpLayoutEpoch] = useState(0);

  const readMetrics = () => {
    const { topbar, botbar } = readLayoutChromePx();
    const vw = typeof window !== 'undefined' ? window.innerWidth : 1200;
    const vh = typeof window !== 'undefined' ? window.innerHeight : 900;
    const dockTopPx = readDockPeekTopPx(onPulse);
    const maxFloatH = Math.max(MIN_PANEL_H, vh - dockTopPx - botbar - 12);
    return { topbar, botbar, vw, vh, maxFloatH, dockTopPx };
  };

  /** Re-measure when Pulse chrome / watchlist shifts `<main>` without a squads state change. */
  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
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
    const capH = Math.min(maxFloatH, MAX_FLOAT_PANEL_H);
    return {
      w: clampDockPeekWidth(w, MIN_PANEL_W),
      h: Math.round(Math.min(capH, Math.max(MIN_PANEL_H, h))),
    };
  }, []);

  const floatDimsFromRefs = useCallback((): { w: number; h: number } => {
    const st = useTokenDockPeekStore.getState();
    const sz = st.dockSquadsPanelSize ?? DEFAULT_SQUADS_PEEK_SIZE;
    const t = transientSizeRef.current;
    if (t) return clampPanelSize(t.w, t.h);
    return clampPanelSize(sz.width, sz.height);
  }, [clampPanelSize]);

  const applyBodyPadForDock = useCallback(
    (side: PeekDockSnapSide, widthPx: number) => {
      if (typeof document === 'undefined') return;
      if (!side) {
        document.documentElement.style.setProperty('--squads-dock-pad-left', '0px');
        document.documentElement.style.setProperty('--squads-dock-pad-right', '0px');
        return;
      }
      const w = clampPanelSize(widthPx, MIN_PANEL_H).w;
      const pad = `${w + BODY_GUTTER_EXTRA_PX}px`;
      if (side === 'left') {
        document.documentElement.style.setProperty('--squads-dock-pad-left', pad);
        document.documentElement.style.setProperty('--squads-dock-pad-right', '0px');
      } else {
        document.documentElement.style.setProperty('--squads-dock-pad-left', '0px');
        document.documentElement.style.setProperty('--squads-dock-pad-right', pad);
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
      document.documentElement.style.setProperty('--squads-dock-pad-left', '0px');
      document.documentElement.style.setProperty('--squads-dock-pad-right', '0px');
    };
  }, [open, dockSnap, panelSize.width, applyBodyPadForDock]);

  const floatingSnapOnce = useCallback(() => {
    if (skipNextFloatingSnapRef.current) {
      skipNextFloatingSnapRef.current = false;
      return;
    }
    const st = useTokenDockPeekStore.getState();
    if (st.dockSquadsDockSnap) return;
    const el = shellRef.current;
    if (typeof window === 'undefined' || !el) return;
    const dims = floatDimsFromRefs();
    const r = el.getBoundingClientRect();
    const ww = r.width > 8 ? r.width : dims.w;
    const hh = r.height > 8 ? r.height : dims.h;
    const { topbar, botbar, vw, vh } = readMetrics();
    const cur = st.dockSquadsPosition;
    const next = snapDockPeekCoords(cur, {
      panelW: ww,
      panelH: hh,
      viewportW: vw,
      viewportH: vh,
      topbarPx: topbar,
      bottomBarPx: botbar,
    });
    setPosition(next);
  }, [floatDimsFromRefs, setPosition]);

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(floatingSnapOnce));
    return () => cancelAnimationFrame(id);
  }, [open, floatingSnapOnce]);

  /** One-time clamp if a prior session stored rail-height dimensions. */
  useEffect(() => {
    if (!open) return;
    const sz = useTokenDockPeekStore.getState().dockSquadsPanelSize ?? DEFAULT_SQUADS_PEEK_SIZE;
    const { w, h } = clampPanelSize(sz.width, sz.height);
    if (Math.abs(w - sz.width) > 2 || Math.abs(h - sz.height) > 2) {
      setPanelSize({ width: w, height: h });
    }
  }, [open, dockSnap, clampPanelSize, setPanelSize]);

  const startFloatingDrag = useCallback(
    (
      pointerId: number,
      clientX: number,
      clientY: number,
      origX: number,
      origY: number,
    ) => {
      const el = shellRef.current;
      if (!el) return false;

      transientSizeRef.current = null;
      lastFloatingLayoutRef.current = null;
      setDockSnap(null);
      setPosition({ x: origX, y: origY });
      movePhaseRef.current = {
        pointerId,
        origX,
        origY,
        startX: clientX,
        startY: clientY,
      };
      draggingRef.current = true;
      setDraggingUi(true);
      document.body.style.setProperty('user-select', 'none');
      try {
        el.setPointerCapture(pointerId);
      } catch {
        /* pointer may already be captured during peel handoff */
      }
      setDockGlow(null);
      return true;
    },
    [setDockSnap, setPosition],
  );

  function beginDragFromHeader(e: ReactPointerEvent<HTMLElement>) {
    e.preventDefault();

    const el = shellRef.current;
    if (!el) return;

    const currentSnap = useTokenDockPeekStore.getState().dockSquadsDockSnap;
    if (currentSnap) {
      const r = el.getBoundingClientRect();
      startFloatingDrag(e.pointerId, e.clientX, e.clientY, r.left, r.top);
      return;
    }

    const cur = useTokenDockPeekStore.getState().dockSquadsPosition;
    startFloatingDrag(e.pointerId, e.clientX, e.clientY, cur.x, cur.y);
  }

  useLayoutEffect(() => {
    if (!open) return;
    const handoff = consumeSquadsPeelDrag();
    if (!handoff) return;
    skipNextFloatingSnapRef.current = true;
    const apply = () =>
      startFloatingDrag(
        handoff.pointerId,
        handoff.clientX,
        handoff.clientY,
        handoff.origX,
        handoff.origY,
      );
    if (!apply()) requestAnimationFrame(apply);
  }, [open, startFloatingDrag]);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const st = useTokenDockPeekStore.getState();

      if (resizingRef.current && resizePhaseRef.current && !st.dockSquadsDockSnap) {
        const rz = resizePhaseRef.current;
        if (rz.pointerId !== e.pointerId) return;
        let nw = rz.ow;
        let nh = rz.oh;
        if (rz.mode === 'corner' || rz.mode === 'right') {
          nw = rz.ow + (e.clientX - rz.startX);
        }
        if (rz.mode === 'corner' || rz.mode === 'bottom') {
          nh = rz.oh + (e.clientY - rz.startY);
        }
        const { w: cw, h: ch } = clampPanelSize(nw, nh);
        transientSizeRef.current = { w: cw, h: ch };
        bumpResizeUi((x) => x + 1);
        return;
      }

      if (resizingRef.current && resizePhaseRef.current && st.dockSquadsDockSnap === 'left') {
        const rz = resizePhaseRef.current;
        if (rz.pointerId !== e.pointerId) return;
        const ph = useTokenDockPeekStore.getState().dockSquadsPanelSize ?? DEFAULT_SQUADS_PEEK_SIZE;
        const nw = clampPanelSize(rz.ow + (e.clientX - rz.startX), ph.height).w;
        setPanelSize({ width: nw, height: ph.height });
        bumpResizeUi((x) => x + 1);
        return;
      }

      if (resizingRef.current && resizePhaseRef.current && st.dockSquadsDockSnap === 'right') {
        const rz = resizePhaseRef.current;
        if (rz.pointerId !== e.pointerId) return;
        const ph = useTokenDockPeekStore.getState().dockSquadsPanelSize ?? DEFAULT_SQUADS_PEEK_SIZE;
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
        if (onPulse && snapped === 'right') {
          embedSquadsOnPulse();
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

  if (!open) return null;

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
        aria-label="Squads chat"
      >
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <SquadsAsidePanel
            embedded
            draggable
            floating
            onDragHandlePointerDown={beginDragFromHeader}
            onClose={() => {
              setOpen(false);
              setDockSnap(null);
            }}
            onDockToRail={() => embedSquadsOnPulse()}
          />
        </div>

        {!dockSnap ? (
          <>
            <div
              role="separator"
              aria-label="Resize squads panel height"
              className={cn(
                'absolute bottom-0 left-2 right-2 z-[5] h-2 cursor-ns-resize',
                draggingUi ? 'pointer-events-none' : 'hover:bg-fg-primary/5',
              )}
              style={{ touchAction: 'none' }}
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
                  mode: 'bottom',
                };
                transientSizeRef.current = { w: d.w, h: d.h };
                document.body.style.setProperty('user-select', 'none');
                shellRef.current?.setPointerCapture(e.pointerId);
              }}
            />
            <div
              role="separator"
              aria-label="Resize squads panel width"
              className={cn(
                'absolute bottom-2 right-0 top-8 z-[5] w-2 cursor-ew-resize',
                draggingUi ? 'pointer-events-none' : 'hover:bg-fg-primary/5',
              )}
              style={{ touchAction: 'none' }}
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
                  mode: 'right',
                };
                transientSizeRef.current = { w: d.w, h: d.h };
                document.body.style.setProperty('user-select', 'none');
                shellRef.current?.setPointerCapture(e.pointerId);
              }}
            />
            <div
              role="separator"
              className={cn(
                'absolute bottom-0 right-0 z-[6] h-4 w-4 cursor-nwse-resize',
                draggingUi ? 'pointer-events-none' : '',
              )}
              style={{ touchAction: 'none' }}
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
                  mode: 'corner',
                };
                transientSizeRef.current = { w: d.w, h: d.h };
                document.body.style.setProperty('user-select', 'none');
                shellRef.current?.setPointerCapture(e.pointerId);
              }}
            >
              <span className="sr-only">Resize squads panel</span>
            </div>
          </>
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
              const side = useTokenDockPeekStore.getState().dockSquadsDockSnap;
              if (!el || !side) return;
              const r = el.getBoundingClientRect();
              resizingRef.current = true;
              resizePhaseRef.current = {
                pointerId: e.pointerId,
                ow: r.width,
                oh: panelSize.height,
                startX: e.clientX,
                startY: e.clientY,
                mode: 'right',
              };
              document.body.style.setProperty('user-select', 'none');
              shellRef.current?.setPointerCapture(e.pointerId);
            }}
          >
            <span className="sr-only">Resize docked squads panel width</span>
          </div>
        )}
      </aside>
    </>
  );
}
