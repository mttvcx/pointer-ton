'use client';

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { GripHorizontal, PanelLeft, PanelRight, X } from 'lucide-react';
import { AlertRulesSection } from '@/components/alerts/AlertRulesSection';
import { useUIStore } from '@/store/ui';

const MIN_W = 280;
const MAX_W = 640;
const MIN_H = 240;
const PAD = 8;
const EDGE_HIT = 6;
const CORNER = 12;
const DOCK_ZONE = 88;

type FloatEdge = 'n' | 's' | 'e' | 'w' | 'nw' | 'ne' | 'sw' | 'se';

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

function bottomBarPx() {
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--app-bottombar-h').trim();
  const m = /^([\d.]+)px$/.exec(raw);
  if (m?.[1]) return parseFloat(m[1]);
  return 52;
}

function clampFrame(top: number, left: number, width: number, height: number) {
  const winW = window.innerWidth;
  const winH = window.innerHeight;
  const bottomGap = bottomBarPx() + PAD;

  let w = clamp(width, MIN_W, MAX_W);
  let h = clamp(height, MIN_H, winH - PAD - bottomGap);
  w = Math.min(w, winW - PAD * 2);
  h = Math.min(h, winH - PAD - bottomGap);

  const l = clamp(left, PAD, winW - w - PAD);
  const t = clamp(top, PAD, winH - h - bottomGap);

  w = Math.min(w, winW - l - PAD);
  h = Math.min(h, winH - t - bottomGap);

  return {
    top: Math.round(t),
    left: Math.round(l),
    width: Math.round(w),
    height: Math.round(h),
  };
}

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

  return clampFrame(top, left, w, h);
}

export function AlertBuilderEmbeddedPlaceholder() {
  const popped = useUIStore((s) => s.alertRulesPopout != null);
  const docked = useUIStore((s) => s.alertRulesDocked);
  const clearFloat = useUIStore((s) => s.setAlertRulesPopout);
  const setDocked = useUIStore((s) => s.setAlertRulesDocked);

  if (docked) {
    return (
      <div
        className="rounded-xl border px-3 py-3 text-center"
        style={{ borderColor: '#202636', backgroundColor: '#11141b' }}
      >
        <p className="text-[11px] leading-snug" style={{ color: '#7f8aa3' }}>
          Alert Builder is docked in the left rail (same layout pattern as co-pilot on the right).
        </p>
        <button
          type="button"
          className="mt-2 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-[11px] font-semibold text-fg-primary hover:bg-white/[0.08]"
          onClick={() => setDocked(false)}
        >
          Close dock
        </button>
      </div>
    );
  }

  if (popped) {
    return (
      <div
        className="rounded-xl border px-3 py-3 text-center"
        style={{ borderColor: '#202636', backgroundColor: '#11141b' }}
      >
        <p className="text-[11px] leading-snug" style={{ color: '#7f8aa3' }}>
          Alert Builder is open in a floating window. Drag the grip to the left edge to dock in the shell, or to the
          right edge to embed back here.
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

  return null;
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
    if (!el || !rect || dragActiveRef.current || resizeActiveRef.current) return;
    el.style.top = `${rect.top}px`;
    el.style.left = `${rect.left}px`;
    el.style.width = `${rect.width}px`;
    el.style.height = `${rect.height}px`;
  }, [rect]);

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
        className="fixed z-[632] flex flex-col overflow-hidden rounded-xl border border-white/10 bg-[#080d14]/97 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl"
      >
        <div className="relative z-[70] flex shrink-0 items-center gap-1 border-b border-white/10 bg-[#11141b]/95 px-1 py-1">
          <div
            role="toolbar"
            className="flex min-w-0 flex-1 cursor-grab select-none items-center gap-1.5 rounded-md px-1.5 py-1 active:cursor-grabbing"
            title="Drag · release on left edge to dock in shell"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              dragActiveRef.current = true;
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
              const next = clampFrame(d.oy + dy, d.ox + dx, d.ow, d.oh);
              applyFrameToDom(next);
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

              if (e.clientX < DOCK_ZONE) {
                dockLeftShell();
                return;
              }
              if (e.clientX > window.innerWidth - DOCK_ZONE) {
                embedInCopilot();
                return;
              }
              const dx = e.clientX - d.startX;
              const dy = e.clientY - d.startY;
              const committed = clampFrame(d.oy + dy, d.ox + dx, d.ow, d.oh);
              setRect(committed);
              applyFrameToDom(committed);
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
              if (rect) applyFrameToDom(rect);
            }}
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

        <div className="relative z-10 min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
          <AlertRulesSection embedInFloatingPanel />
        </div>

        <div
          role="presentation"
          className="pointer-events-auto absolute bottom-0 left-[12px] right-[12px] z-[45] cursor-ns-resize"
          style={{ height: EDGE_HIT }}
          onPointerDown={(e) => handleResizePointerDown(e, 's')}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
        />
        <div
          role="presentation"
          className="pointer-events-auto absolute bottom-[10px] left-0 top-[10px] z-[45] cursor-ew-resize"
          style={{ width: EDGE_HIT }}
          onPointerDown={(e) => handleResizePointerDown(e, 'w')}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
        />
        <div
          role="presentation"
          className="pointer-events-auto absolute bottom-[10px] right-0 top-[10px] z-[45] cursor-ew-resize"
          style={{ width: EDGE_HIT }}
          onPointerDown={(e) => handleResizePointerDown(e, 'e')}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
        />
        <div
          role="presentation"
          className="pointer-events-auto absolute left-0 top-0 z-[50] cursor-nwse-resize"
          style={{ width: CORNER, height: CORNER }}
          onPointerDown={(e) => handleResizePointerDown(e, 'nw')}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
        />
        <div
          role="presentation"
          className="pointer-events-auto absolute right-0 top-0 z-[50] cursor-nesw-resize"
          style={{ width: CORNER, height: CORNER }}
          onPointerDown={(e) => handleResizePointerDown(e, 'ne')}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
        />
        <div
          role="presentation"
          className="pointer-events-auto absolute bottom-0 left-0 z-[50] cursor-nesw-resize"
          style={{ width: CORNER, height: CORNER }}
          onPointerDown={(e) => handleResizePointerDown(e, 'sw')}
          onPointerMove={onResizePointerMove}
          onPointerUp={onResizePointerUp}
          onPointerCancel={onResizePointerUp}
        />
        <div
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
