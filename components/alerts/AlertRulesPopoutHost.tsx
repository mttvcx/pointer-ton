'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GripHorizontal, PanelLeft, PanelRight, X } from 'lucide-react';
import { XMonitorPanel } from '@/components/monitor/XMonitorPanel';
import { useUIStore } from '@/store/ui';
import { clampAlertRulesPopoutFrame } from '@/lib/ui/alertRulesPopoutFrame';
import { isFloatPanelDragSurface } from '@/lib/ui/floatPanelDrag';

const EDGE_HIT = 6;
const CORNER = 12;
const DOCK_ZONE = 88;
/** Per-frame smoothing while dragging — higher = snappier, lower = floatier */
const DRAG_SMOOTH = 0.34;
/** Release snap when not docking — ease-out settle into clamped rect */
const SNAP_MS = 210;

function easeOutCubic(t: number) {
  const u = 1 - t;
  return 1 - u * u * u;
}

type FloatEdge = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

function applyResize(
  start: { top: number; left: number; w: number; h: number },
  edge: FloatEdge,
  dx: number,
  dy: number,
) {
  let { top, left, w, h } = start;

  if (edge.includes('e')) w += dx;
  if (edge.includes('w')) {
    left += dx;
    w -= dx;
  }
  if (edge.includes('s')) h += dy;
  if (edge.includes('n')) {
    top += dy;
    h -= dy;
  }

  return clampAlertRulesPopoutFrame(top, left, w, h);
}

export function AlertBuilderEmbeddedPlaceholder() {
  const popped = useUIStore((s) => s.alertRulesPopout != null);
  const clearFloat = useUIStore((s) => s.setAlertRulesPopout);

  if (!popped) return null;

  return (
    <div
      className="rounded-2xl border border-white/10 bg-[rgba(255,255,255,0.04)] px-4 py-4 text-center backdrop-blur-md shadow-[0_1px_0_0_rgba(255,255,255,0.06)_inset]"
    >
      <p className="text-[11px] leading-relaxed text-fg-secondary">
        X monitor is open in a floating window. Drag the grip to the left edge to dock, or close to use the
        tracker Monitor tab.
      </p>
      <button
        type="button"
        className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-fg-primary hover:bg-white/[0.08]"
        onClick={() => clearFloat(null)}
      >
        Put back in co-pilot
      </button>
    </div>
  );
}

export function AlertRulesPopoutHost() {
  const rect = useUIStore((s) => s.alertRulesPopout);
  const setRect = useUIStore((s) => s.setAlertRulesPopout);
  const setDocked = useUIStore((s) => s.setAlertRulesDocked);
  const [mounted, setMounted] = useState(false);
  const [dockHighlight, setDockHighlight] = useState<'left' | 'right' | null>(null);

  const panelRef = useRef<HTMLDivElement | null>(null);
  const dragActiveRef = useRef(false);
  const resizeActiveRef = useRef(false);
  const snapAnimatingRef = useRef(false);
  const dragSmoothRafRef = useRef<number | null>(null);
  const snapRafRef = useRef<number | null>(null);
  const dragTargetFrameRef = useRef<{ top: number; left: number; w: number; h: number } | null>(null);
  const dragVisualFrameRef = useRef<{ top: number; left: number; w: number; h: number } | null>(null);
  const [floatDragActive, setFloatDragActive] = useState(false);

  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    ox: number;
    oy: number;
    ow: number;
    oh: number;
  } | null>(null);

  const resizeRef = useRef<{
    edge: FloatEdge;
    pointerId: number;
    sx: number;
    sy: number;
    top: number;
    left: number;
    w: number;
    h: number;
  } | null>(null);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el || !rect || dragActiveRef.current || resizeActiveRef.current || snapAnimatingRef.current) return;
    el.style.top = `${rect.top}px`;
    el.style.left = `${rect.left}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
  }, [rect]);

  const cancelDragSmoothLoop = useCallback(() => {
    if (dragSmoothRafRef.current != null) {
      cancelAnimationFrame(dragSmoothRafRef.current);
      dragSmoothRafRef.current = null;
    }
  }, []);

  const cancelSnapAnimation = useCallback(() => {
    if (snapRafRef.current != null) {
      cancelAnimationFrame(snapRafRef.current);
      snapRafRef.current = null;
    }
    snapAnimatingRef.current = false;
  }, []);

  const runDragSmoothLoop = useCallback(() => {
    const el = panelRef.current;
    const target = dragTargetFrameRef.current;
    const vis = dragVisualFrameRef.current;
    if (!el || !target || !vis) {
      dragSmoothRafRef.current = null;
      return;
    }
    vis.left += (target.left - vis.left) * DRAG_SMOOTH;
    vis.top += (target.top - vis.top) * DRAG_SMOOTH;
    el.style.left = `${Math.round(vis.left)}px`;
    el.style.top = `${Math.round(vis.top)}px`;
    el.style.width = `${target.w}px`;
    el.style.height = `${target.h}px`;

    const dist = Math.hypot(target.left - vis.left, target.top - vis.top);
    if (dragActiveRef.current || dist > 0.5) {
      dragSmoothRafRef.current = requestAnimationFrame(runDragSmoothLoop);
    } else {
      dragSmoothRafRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      cancelDragSmoothLoop();
      cancelSnapAnimation();
    };
  }, [cancelDragSmoothLoop, cancelSnapAnimation]);

  useEffect(() => {
    if (!rect) return;
    function onKey(e: KeyboardEvent) {
      if (e.key !== 'Escape') return;
      const t = e.target as HTMLElement | null;
      if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.isContentEditable) return;
      setRect(null);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [rect, setRect]);

  const dockLeftShell = useCallback(() => {
    setDocked(true);
  }, [setDocked]);

  const embedInCopilot = useCallback(() => {
    setRect(null);
  }, [setRect]);

  const applyFrameToDom = useCallback((f: { top: number; left: number; width: number; height: number }) => {
    const el = panelRef.current;
    if (!el) return;
    el.style.top = `${f.top}px`;
    el.style.left = `${f.left}px`;
    el.style.width = `${f.width}px`;
    el.style.height = `${f.height}px`;
  }, []);

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent) => {
      const d = resizeRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      const next = applyResize({ top: d.top, left: d.left, w: d.w, h: d.h }, d.edge, dx, dy);
      applyFrameToDom(next);
    },
    [applyFrameToDom],
  );

  const onResizePointerUp = useCallback(
    (e: React.PointerEvent) => {
      const d = resizeRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      resizeRef.current = null;
      resizeActiveRef.current = false;
      const el = panelRef.current;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      const next = applyResize({ top: d.top, left: d.left, w: d.w, h: d.h }, d.edge, dx, dy);
      setRect(next);
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
      if (el) {
        el.style.top = `${next.top}px`;
        el.style.left = `${next.left}px`;
        el.style.width = `${next.width}px`;
        el.style.height = `${next.height}px`;
      }
    },
    [setRect],
  );

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>, edge: FloatEdge) => {
      if (!rect || e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      resizeActiveRef.current = true;
      resizeRef.current = {
        edge,
        pointerId: e.pointerId,
        sx: e.clientX,
        sy: e.clientY,
        top: rect.top,
        left: rect.left,
        w: rect.width,
        h: rect.height,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [rect],
  );

  if (!mounted || !rect) return null;

  const updateDockHint = (clientX: number) => {
    if (clientX < DOCK_ZONE) setDockHighlight('left');
    else if (clientX > window.innerWidth - DOCK_ZONE) setDockHighlight('right');
    else setDockHighlight(null);
  };

  return createPortal(
    <>
      {dockHighlight ? (
        <div
          className="pointer-events-none fixed inset-0 z-[631]"
          aria-hidden
        >
          {dockHighlight === 'left' ? (
            <div className="absolute inset-y-0 left-0 w-[88px] border-r border-accent-primary/50 bg-accent-primary/15 animate-in fade-in duration-150" />
          ) : (
            <div className="absolute inset-y-0 right-0 w-[88px] border-l border-accent-primary/50 bg-accent-primary/15 animate-in fade-in duration-150" />
          )}
        </div>
      ) : null}

      <div
        ref={panelRef}
        className={[
          'fixed z-[632] flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#080d14]/97 backdrop-blur-xl will-change-transform',
          floatDragActive
            ? 'scale-[1.012] shadow-[0_28px_64px_-14px_rgba(0,0,0,0.62)] ring-1 ring-white/[0.12] transition-[transform,box-shadow,ring-color] duration-200 ease-out'
            : 'shadow-[0_24px_48px_-12px_rgba(0,0,0,0.55)] transition-[transform,box-shadow,ring-color] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
        ].join(' ')}
        onPointerDown={(e) => {
          if (e.button !== 0 || !rect) return;
          const t = e.target as HTMLElement;
          if (!t.closest('[data-alert-drag-chrome]')) return;
          if (!isFloatPanelDragSurface(e.target)) return;
          cancelSnapAnimation();
          cancelDragSmoothLoop();
          dragActiveRef.current = true;
          setFloatDragActive(true);
          const frame = { top: rect.top, left: rect.left, w: rect.width, h: rect.height };
          dragVisualFrameRef.current = { ...frame };
          dragTargetFrameRef.current = { ...frame };
          dragRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            ox: rect.left,
            oy: rect.top,
            ow: rect.width,
            oh: rect.height,
          };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d || e.pointerId !== d.pointerId) return;
          const dx = e.clientX - d.startX;
          const dy = e.clientY - d.startY;
          updateDockHint(e.clientX);
          const next = clampAlertRulesPopoutFrame(d.oy + dy, d.ox + dx, d.ow, d.oh);
          const tgt = dragTargetFrameRef.current;
          if (tgt) {
            tgt.top = next.top;
            tgt.left = next.left;
            tgt.w = next.width;
            tgt.h = next.height;
          }
          if (dragSmoothRafRef.current == null) {
            dragSmoothRafRef.current = requestAnimationFrame(runDragSmoothLoop);
          }
        }}
        onPointerUp={(e) => {
          const d = dragRef.current;
          if (!d || e.pointerId !== d.pointerId) return;
          try {
            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
          } catch {
            /* ignore */
          }
          dragRef.current = null;
          dragActiveRef.current = false;
          setDockHighlight(null);
          cancelDragSmoothLoop();

          if (e.clientX < DOCK_ZONE) {
            setFloatDragActive(false);
            dragTargetFrameRef.current = null;
            dragVisualFrameRef.current = null;
            dockLeftShell();
            return;
          }
          if (e.clientX > window.innerWidth - DOCK_ZONE) {
            setFloatDragActive(false);
            dragTargetFrameRef.current = null;
            dragVisualFrameRef.current = null;
            embedInCopilot();
            return;
          }
          const dx = e.clientX - d.startX;
          const dy = e.clientY - d.startY;
          const committed = clampAlertRulesPopoutFrame(d.oy + dy, d.ox + dx, d.ow, d.oh);

          const vis = dragVisualFrameRef.current;
          dragTargetFrameRef.current = null;
          if (!vis) {
            setRect(committed);
            applyFrameToDom(committed);
            setFloatDragActive(false);
            return;
          }

          const start = { top: vis.top, left: vis.left };
          const dist = Math.hypot(committed.left - start.left, committed.top - start.top);
          if (dist < 1.5) {
            dragVisualFrameRef.current = null;
            setRect(committed);
            applyFrameToDom(committed);
            setFloatDragActive(false);
            return;
          }

          snapAnimatingRef.current = true;
          const t0 = performance.now();
          const tick = (now: number) => {
            const u = Math.min(1, (now - t0) / SNAP_MS);
            const k = easeOutCubic(u);
            const frame = {
              top: Math.round(start.top + (committed.top - start.top) * k),
              left: Math.round(start.left + (committed.left - start.left) * k),
              width: committed.width,
              height: committed.height,
            };
            applyFrameToDom(frame);
            if (u < 1) {
              snapRafRef.current = requestAnimationFrame(tick);
            } else {
              snapRafRef.current = null;
              snapAnimatingRef.current = false;
              dragVisualFrameRef.current = null;
              setRect(committed);
              setFloatDragActive(false);
            }
          };
          snapRafRef.current = requestAnimationFrame(tick);
        }}
        onPointerCancel={(e) => {
          const d = dragRef.current;
          if (d && e.pointerId === d.pointerId) {
            try {
              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
            } catch {
              /* ignore */
            }
          }
          dragRef.current = null;
          dragActiveRef.current = false;
          setDockHighlight(null);
          cancelDragSmoothLoop();
          cancelSnapAnimation();
          dragTargetFrameRef.current = null;
          dragVisualFrameRef.current = null;
          setFloatDragActive(false);
          if (rect) applyFrameToDom(rect);
        }}
      >
        <div
          data-alert-drag-chrome
          className="relative z-[70] flex shrink-0 items-center gap-1 border-b border-white/[0.06] bg-gradient-to-b from-white/[0.07] to-transparent px-2 py-1.5 backdrop-blur-md"
        >
          <div
            role="toolbar"
            className="flex min-w-0 flex-1 select-none items-center gap-1.5 rounded-md px-1.5 py-1"
            title="Drag header or side edges · release on left edge to dock in shell"
          >
            <GripHorizontal className="h-4 w-4 shrink-0 text-fg-muted" aria-hidden />
            <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-fg-primary">Alert builder</span>
          </div>

          <button
            type="button"
            className="focus-ring shrink-0 rounded-md p-1.5 text-fg-muted hover:bg-white/5 hover:text-white"
            title="Dock in left shell (pushes main content)"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              dockLeftShell();
            }}
          >
            <PanelLeft className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            className="focus-ring shrink-0 rounded-md p-1.5 text-fg-muted hover:bg-white/5 hover:text-white"
            title="Put back into co-pilot"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              embedInCopilot();
            }}
          >
            <PanelRight className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            className="focus-ring shrink-0 rounded-md p-1.5 text-fg-muted hover:bg-white/5 hover:text-white"
            title="Close"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setRect(null);
            }}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </div>

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-3 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <XMonitorPanel embedded />
        </div>

        <div
          data-alert-drag-chrome
          className="pointer-events-auto absolute bottom-4 left-2 top-12 z-[40] w-3 cursor-grab touch-none rounded-sm transition-colors duration-150 hover:bg-white/[0.05] active:cursor-grabbing"
          title="Drag · left edge"
          aria-hidden
        />
        <div
          data-alert-drag-chrome
          className="pointer-events-auto absolute bottom-4 right-2 top-12 z-[40] w-3 cursor-grab touch-none rounded-sm transition-colors duration-150 hover:bg-white/[0.05] active:cursor-grabbing"
          title="Drag · right edge"
          aria-hidden
        />

        <div
          data-float-resize="1"
          role="presentation"
          className="pointer-events-auto absolute bottom-0 left-[12px] right-[12px] z-[45] cursor-ns-resize"
          style={{ height: EDGE_HIT }}
          onPointerDown={(e) => handleResizePointerDown(e, 's')}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
        />
        <div
          data-float-resize="1"
          role="presentation"
          className="pointer-events-auto absolute bottom-[10px] left-0 top-[10px] z-[45] cursor-ew-resize"
          style={{ width: EDGE_HIT }}
          onPointerDown={(e) => handleResizePointerDown(e, 'w')}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
        />
        <div
          data-float-resize="1"
          role="presentation"
          className="pointer-events-auto absolute bottom-[10px] right-0 top-[10px] z-[45] cursor-ew-resize"
          style={{ width: EDGE_HIT }}
          onPointerDown={(e) => handleResizePointerDown(e, 'e')}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
        />
        <div
          data-float-resize="1"
          role="presentation"
          className="pointer-events-auto absolute left-0 top-0 z-[50] cursor-nwse-resize"
          style={{ width: CORNER, height: CORNER }}
          onPointerDown={(e) => handleResizePointerDown(e, 'nw')}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
        />
        <div
          data-float-resize="1"
          role="presentation"
          className="pointer-events-auto absolute right-0 top-0 z-[50] cursor-nesw-resize"
          style={{ width: CORNER, height: CORNER }}
          onPointerDown={(e) => handleResizePointerDown(e, 'ne')}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
        />
        <div
          data-float-resize="1"
          role="presentation"
          className="pointer-events-auto absolute bottom-0 left-0 z-[50] cursor-nesw-resize"
          style={{ width: CORNER, height: CORNER }}
          onPointerDown={(e) => handleResizePointerDown(e, 'sw')}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
        />
        <div
          data-float-resize="1"
          role="presentation"
          className="pointer-events-auto absolute bottom-0 right-0 z-[50] cursor-nwse-resize"
          style={{ width: CORNER, height: CORNER }}
          onPointerDown={(e) => handleResizePointerDown(e, 'se')}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
        />
      </div>
    </>,
    document.body,
  );
}
