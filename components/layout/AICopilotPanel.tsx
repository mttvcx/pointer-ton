'use client';

import { type ElementRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  ArrowUpToLine,
  ChevronsLeft,
  ChevronsRight,
  Globe,
  Headphones,
  PanelRight,
  Pill,
  Settings2,
  Sparkles,
  X,
} from 'lucide-react';
import {
  selectActiveEntity,
  useUIStore,
  computeCopilotAlertsReadIso,
} from '@/store/ui';
import { useCopilotMode } from '@/components/copilot/CopilotModeContext';
import { ContextCard } from '@/components/ai/ContextCard';
import { AskBox } from '@/components/ai/AskBox';
import { XMonitorCopilotCard } from '@/components/monitor/XMonitorCopilotCard';
import { AlertBuilderEmbeddedPlaceholder } from '@/components/alerts/AlertRulesPopoutHost';
import { AlertsTicker } from '@/components/ai/AlertsTicker';
import { useAlertsTickerQuery } from '@/lib/hooks/useAlertsTicker';
import { cn } from '@/lib/utils/cn';
import { isFloatPanelDragSurface } from '@/lib/ui/floatPanelDrag';

/** Docked rail: keep moderate width. */
const DOCK_MIN_WIDTH = 320;
const DOCK_MAX_WIDTH = 480;
/** Floated panel: allow a wider range so it feels like a real window. */
const FLOAT_MIN_WIDTH = 260;
const FLOAT_MAX_WIDTH = 720;
const RAIL_PX = 44;
const PANEL_TRANSITION_MS = 200;
const FLOAT_EDGE_HIT = 6;
const FLOAT_CORNER = 12;
const MIN_FLOAT_H = 200;
const COPILOT_DOCK_ZONE_PX = 88;

type FloatEdge = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

function bottomBarPx(): number {
  if (typeof window === 'undefined') return 52;
  const raw = getComputedStyle(document.documentElement).getPropertyValue('--app-bottombar-h').trim();
  const n = parseFloat(raw);
  return Number.isFinite(n) ? n : 52;
}

function maxFloatPanelHeight(top: number): number {
  return window.innerHeight - top - bottomBarPx() - 8;
}

function clamp(n: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, n));
}

/** Drag edges for floating co-pilot; refs only used inside pointer handlers. */
/* eslint-disable react-hooks/refs */
function CopilotFloatResizeChrome({
  asideRef,
}: {
  asideRef: React.RefObject<ElementRef<'aside'> | null>;
}) {
  const drag = useRef<{
    edge: FloatEdge;
    sx: number;
    sy: number;
    top: number;
    right: number;
    left: number;
    useLeft: boolean;
    w: number;
    h: number;
  } | null>(null);

  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.sx;
    const dy = e.clientY - d.sy;
    const maxH = maxFloatPanelHeight(d.top);
    const useLeft = d.useLeft;

    switch (d.edge) {
      case 'e': {
        const nw = clamp(d.w + dx, FLOAT_MIN_WIDTH, FLOAT_MAX_WIDTH);
        if (useLeft) {
          useUIStore.setState({ panelWidth: nw });
        } else {
          const nr = clamp(d.right - (nw - d.w), 8, window.innerWidth - 24);
          useUIStore.setState({ panelWidth: nw, copilotRight: nr });
        }
        break;
      }
      case 'w': {
        const nw = clamp(d.w - dx, FLOAT_MIN_WIDTH, FLOAT_MAX_WIDTH);
        if (useLeft) {
          const nl = d.left + (d.w - nw);
          const maxLeft = window.innerWidth - nw - 8;
          const clampedNl = clamp(nl, 8, maxLeft);
          useUIStore.setState({ panelWidth: nw, copilotLeft: clampedNl });
        } else {
          useUIStore.setState({ panelWidth: nw });
        }
        break;
      }
      case 's': {
        const nh = clamp(d.h + dy, MIN_FLOAT_H, maxH);
        useUIStore.setState({ copilotFloatHeight: nh });
        break;
      }
      case 'n': {
        let nh = clamp(d.h - dy, MIN_FLOAT_H, maxH);
        let nt = d.top + d.h - nh;
        nt = clamp(nt, 52, window.innerHeight - MIN_FLOAT_H - bottomBarPx() - 8);
        nh = clamp(d.top + d.h - nt, MIN_FLOAT_H, maxFloatPanelHeight(nt));
        useUIStore.setState({ copilotTop: nt, copilotFloatHeight: nh });
        break;
      }
      case 'se': {
        const nh = clamp(d.h + dy, MIN_FLOAT_H, maxH);
        const nw = clamp(d.w + dx, FLOAT_MIN_WIDTH, FLOAT_MAX_WIDTH);
        if (useLeft) {
          useUIStore.setState({ panelWidth: nw, copilotFloatHeight: nh });
        } else {
          const nr = clamp(d.right - (nw - d.w), 8, window.innerWidth - 24);
          useUIStore.setState({ panelWidth: nw, copilotRight: nr, copilotFloatHeight: nh });
        }
        break;
      }
      case 'sw': {
        const nw = clamp(d.w - dx, FLOAT_MIN_WIDTH, FLOAT_MAX_WIDTH);
        const nh = clamp(d.h + dy, MIN_FLOAT_H, maxH);
        if (useLeft) {
          const nl = d.left + (d.w - nw);
          const maxLeft = window.innerWidth - nw - 8;
          const clampedNl = clamp(nl, 8, maxLeft);
          useUIStore.setState({ panelWidth: nw, copilotLeft: clampedNl, copilotFloatHeight: nh });
        } else {
          useUIStore.setState({ panelWidth: nw, copilotFloatHeight: nh });
        }
        break;
      }
      case 'ne': {
        let nh = clamp(d.h - dy, MIN_FLOAT_H, maxH);
        let nt = d.top + d.h - nh;
        nt = clamp(nt, 52, window.innerHeight - 120);
        nh = clamp(d.top + d.h - nt, MIN_FLOAT_H, maxFloatPanelHeight(nt));
        const nw = clamp(d.w + dx, FLOAT_MIN_WIDTH, FLOAT_MAX_WIDTH);
        if (useLeft) {
          useUIStore.setState({ copilotTop: nt, copilotFloatHeight: nh, panelWidth: nw });
        } else {
          const nr = clamp(d.right - (nw - d.w), 8, window.innerWidth - 24);
          useUIStore.setState({ copilotTop: nt, copilotFloatHeight: nh, panelWidth: nw, copilotRight: nr });
        }
        break;
      }
      case 'nw': {
        let nh = clamp(d.h - dy, MIN_FLOAT_H, maxH);
        let nt = d.top + d.h - nh;
        nt = clamp(nt, 52, window.innerHeight - 120);
        nh = clamp(d.top + d.h - nt, MIN_FLOAT_H, maxFloatPanelHeight(nt));
        const nw = clamp(d.w - dx, FLOAT_MIN_WIDTH, FLOAT_MAX_WIDTH);
        if (useLeft) {
          const nl = d.left + (d.w - nw);
          const maxLeft = window.innerWidth - nw - 8;
          const clampedNl = clamp(nl, 8, maxLeft);
          useUIStore.setState({ copilotTop: nt, copilotFloatHeight: nh, panelWidth: nw, copilotLeft: clampedNl });
        } else {
          useUIStore.setState({ copilotTop: nt, copilotFloatHeight: nh, panelWidth: nw });
        }
        break;
      }
      default:
        break;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    drag.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
  };

  const onDown =
    (edge: FloatEdge) =>
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      const st = useUIStore.getState();
      const rect = asideRef.current?.getBoundingClientRect();
      const measuredH = rect ? Math.round(rect.height) : maxFloatPanelHeight(st.copilotTop);
      const h = st.copilotFloatHeight ?? measuredH;
      if (st.copilotFloatHeight == null) {
        useUIStore.setState({ copilotFloatHeight: h });
      }
      drag.current = {
        edge,
        sx: e.clientX,
        sy: e.clientY,
        top: st.copilotTop,
        right: st.copilotRight,
        left: st.copilotLeft,
        useLeft: st.copilotFloatUseLeftAnchor,
        w: st.panelWidth,
        h,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
    };

  const E = FLOAT_EDGE_HIT;
  const C = FLOAT_CORNER;

  return (
    <>
      <div
        data-float-resize="1"
        role="presentation"
        className="pointer-events-auto absolute left-[10px] right-[10px] top-0 z-[45] cursor-ns-resize"
        style={{ height: E }}
        onPointerDown={onDown('n')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div
        data-float-resize="1"
        role="presentation"
        className="pointer-events-auto absolute bottom-0 left-[10px] right-[10px] z-[45] cursor-ns-resize"
        style={{ height: E }}
        onPointerDown={onDown('s')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div
        data-float-resize="1"
        role="presentation"
        className="pointer-events-auto absolute bottom-[10px] left-0 top-[10px] z-[45] cursor-ew-resize"
        style={{ width: E }}
        onPointerDown={onDown('w')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div
        data-float-resize="1"
        role="presentation"
        className="pointer-events-auto absolute bottom-[10px] right-0 top-[10px] z-[45] cursor-ew-resize"
        style={{ width: E }}
        onPointerDown={onDown('e')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div
        data-float-resize="1"
        role="presentation"
        className="pointer-events-auto absolute left-0 top-0 z-[50] cursor-nwse-resize"
        style={{ width: C, height: C }}
        onPointerDown={onDown('nw')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div
        data-float-resize="1"
        role="presentation"
        className="pointer-events-auto absolute right-0 top-0 z-[50] cursor-nesw-resize"
        style={{ width: C, height: C }}
        onPointerDown={onDown('ne')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div
        data-float-resize="1"
        role="presentation"
        className="pointer-events-auto bottom-0 left-0 z-[50] cursor-nesw-resize"
        style={{ width: C, height: C, position: 'absolute' }}
        onPointerDown={onDown('sw')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
      <div
        data-float-resize="1"
        role="presentation"
        className="pointer-events-auto bottom-0 right-0 z-[50] cursor-nwse-resize"
        style={{ width: C, height: C, position: 'absolute' }}
        onPointerDown={onDown('se')}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
      />
    </>
  );
}
/* eslint-enable react-hooks/refs */

function copilotUnreadCount(
  alerts: { createdAt: string }[] | undefined,
  lastReadAt: string | null,
): number {
  if (!alerts?.length) return 0;
  if (!lastReadAt) return 0;
  const t = new Date(lastReadAt).getTime();
  return alerts.filter((a) => new Date(a.createdAt).getTime() > t).length;
}

function CopilotAlertsReadSync() {
  const displayMode = useUIStore((s) => s.copilotDisplayMode);
  const pillExpanded = useUIStore((s) => s.copilotPillExpanded);
  const open = useUIStore((s) => s.panelOpen);
  const collapsed = useUIStore((s) => s.panelCollapsed);
  const lastRead = useUIStore((s) => s.lastCopilotAlertsReadAt);
  const markRead = useUIStore((s) => s.markCopilotAlertsRead);
  const { data } = useAlertsTickerQuery();

  const surfaceOpen = displayMode === 'pill' ? pillExpanded : open && !collapsed;

  useEffect(() => {
    if (!data?.length || !surfaceOpen) return;
    const nextIso = computeCopilotAlertsReadIso(data);
    const prevT = lastRead ? new Date(lastRead).getTime() : 0;
    if (new Date(nextIso).getTime() <= prevT) return;
    markRead(data);
  }, [data, surfaceOpen, lastRead, markRead]);

  return null;
}

export function AICopilotPanel() {
  // Task R: when the embedded co-pilot is in `sidebar` mode this rail is the
  // active surface; the header gets a "Move to top" button that switches
  // back to `embedded` and closes the rail.
  const { setMode: setCopilotMode } = useCopilotMode();
  const displayMode = useUIStore((s) => s.copilotDisplayMode);
  const setDisplayMode = useUIStore((s) => s.setCopilotDisplayMode);
  const open = useUIStore((s) => s.panelOpen);
  const collapsed = useUIStore((s) => s.panelCollapsed);
  const width = useUIStore((s) => s.panelWidth);
  const detached = useUIStore((s) => s.copilotDetached);
  const floatTop = useUIStore((s) => s.copilotTop);
  const floatRight = useUIStore((s) => s.copilotRight);
  const floatLeft = useUIStore((s) => s.copilotLeft);
  const copilotFloatUseLeftAnchor = useUIStore((s) => s.copilotFloatUseLeftAnchor);
  const copilotRailSide = useUIStore((s) => s.copilotRailSide);
  const copilotFloatHeight = useUIStore((s) => s.copilotFloatHeight);
  const setOpen = useUIStore((s) => s.setPanelOpen);
  const setCollapsed = useUIStore((s) => s.setPanelCollapsed);
  const setWidth = useUIStore((s) => s.setPanelWidth);
  const setDetached = useUIStore((s) => s.setCopilotDetached);
  const setCopilotFloat = useUIStore((s) => s.setCopilotFloat);
  const setCopilotFloatLeft = useUIStore((s) => s.setCopilotFloatLeft);
  const setCopilotRailSide = useUIStore((s) => s.setCopilotRailSide);
  const lastRead = useUIStore((s) => s.lastCopilotAlertsReadAt);
  const entity = useUIStore(selectActiveEntity);
  const lockedEntity = useUIStore((s) => s.lockedEntity);
  const hoveredEntity = useUIStore((s) => s.hoveredEntity);

  const alertRulesPopped = useUIStore((s) => s.alertRulesPopout != null);
  const alertRulesDocked = useUIStore((s) => s.alertRulesDocked);

  const [narrow, setNarrow] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1023px)');
    const apply = () => setNarrow(mq.matches);
    apply();
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, []);

  useEffect(() => {
    if (narrow && open && collapsed) setCollapsed(false);
  }, [narrow, open, collapsed, setCollapsed]);

  const { data: alertsData } = useAlertsTickerQuery();
  const unread = useMemo(
    () => copilotUnreadCount(alertsData, lastRead),
    [alertsData, lastRead],
  );

  const [panelResizing, setPanelResizing] = useState(false);
  const panelResizeActive = useRef(false);

  const outerWidth = !open ? 0 : collapsed ? RAIL_PX : width;

  const floatAsideRef = useRef<ElementRef<'aside'>>(null);

  const floatHeightStyle =
    copilotFloatHeight != null
      ? `${copilotFloatHeight}px`
      : `calc(100dvh - ${floatTop}px - var(--app-bottombar-h) - 8px)`;
  const float0 = useRef<{
    px: number;
    py: number;
    top: number;
    right: number;
    left: number;
    useLeftAnchor: boolean;
    w: number;
  } | null>(null);
  const floatDrag = useRef(false);
  const dockedLeftResizeRef = useRef<{ pointerId: number; sx: number; sw: number } | null>(null);

  const onResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (narrow) return;
      panelResizeActive.current = true;
      setPanelResizing(true);
      const st = useUIStore.getState();
      if (!st.copilotDetached && st.copilotRailSide === 'left') {
        dockedLeftResizeRef.current = { pointerId: e.pointerId, sx: e.clientX, sw: width };
      } else {
        dockedLeftResizeRef.current = null;
      }
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    },
    [narrow, width],
  );

  const onResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (narrow || !panelResizeActive.current) return;
      const st = useUIStore.getState();
      const minW = st.copilotDetached ? FLOAT_MIN_WIDTH : DOCK_MIN_WIDTH;
      const maxW = st.copilotDetached ? FLOAT_MAX_WIDTH : DOCK_MAX_WIDTH;
      let next: number;
      if (st.copilotDetached) {
        const rightEdge = window.innerWidth - st.copilotRight;
        next = Math.min(maxW, Math.max(minW, rightEdge - e.clientX));
      } else if (st.copilotRailSide === 'left') {
        const d = dockedLeftResizeRef.current;
        if (!d || e.pointerId !== d.pointerId) return;
        next = Math.min(maxW, Math.max(minW, d.sw + (e.clientX - d.sx)));
      } else {
        next = Math.min(maxW, Math.max(minW, window.innerWidth - e.clientX));
      }
      setWidth(next);
    },
    [narrow, setWidth],
  );

  const onResizePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    panelResizeActive.current = false;
    setPanelResizing(false);
    dockedLeftResizeRef.current = null;
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
  }, []);

  function onFloatShellPointerDown(e: React.PointerEvent<HTMLElement>) {
    if (e.button !== 0) return;
    const t = e.target as HTMLElement;
    if (!t.closest('.copilot-drag-handle')) return;
    if (!isFloatPanelDragSurface(e.target)) return;
    floatDrag.current = true;
    float0.current = {
      px: e.clientX,
      py: e.clientY,
      top: floatTop,
      right: floatRight,
      left: floatLeft,
      useLeftAnchor: copilotFloatUseLeftAnchor,
      w: width,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
    e.stopPropagation();
  }

  function onFloatShellPointerMove(e: React.PointerEvent<HTMLElement>) {
    if (!floatDrag.current || !float0.current) return;
    const d = float0.current;
    const dy = e.clientY - d.py;
    const dx = e.clientX - d.px;
    const topbar = 52;
    const minBottomRoom = 160;
    const nextTop = Math.min(
      window.innerHeight - minBottomRoom,
      Math.max(topbar, d.top + dy),
    );
    const minFloat = FLOAT_MIN_WIDTH;
    if (d.useLeftAnchor) {
      const nextLeft = Math.min(window.innerWidth - d.w - 8, Math.max(8, d.left + dx));
      setCopilotFloatLeft(nextTop, nextLeft);
    } else {
      const nextRight = Math.min(window.innerWidth - minFloat - 8, Math.max(8, d.right - dx));
      setCopilotFloat(nextTop, nextRight);
    }
  }

  function onFloatShellPointerUp(e: React.PointerEvent<HTMLElement>) {
    if (!floatDrag.current) return;
    floatDrag.current = false;
    float0.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
    if (e.clientX < COPILOT_DOCK_ZONE_PX) {
      setCopilotRailSide('left');
      setDetached(false);
      return;
    }
    if (e.clientX > window.innerWidth - COPILOT_DOCK_ZONE_PX) {
      setCopilotRailSide('right');
      setDetached(false);
      return;
    }
    const st = useUIStore.getState();
    if (!st.copilotFloatUseLeftAnchor && st.copilotRight <= 56) {
      setCopilotFloat(st.copilotTop, 8);
    } else if (st.copilotFloatUseLeftAnchor && st.copilotLeft <= 56) {
      setCopilotFloatLeft(st.copilotTop, 8);
    }
  }

  useEffect(() => {
    if (detached && collapsed) setCollapsed(false);
  }, [detached, collapsed, setCollapsed]);

  const copilotStatus: 'idle' | 'watching' | 'armed' = lockedEntity
    ? 'armed'
    : hoveredEntity
      ? 'watching'
      : 'idle';

  const expandedBody = (
    <>
      {!narrow && !detached ? (
        copilotRailSide === 'left' ? (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize co-pilot panel"
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerUp}
            className="absolute right-0 top-0 z-20 h-full w-2 translate-x-1/2 cursor-col-resize bg-transparent hover:bg-accent-primary/35"
          />
        ) : (
          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize co-pilot panel"
            onPointerDown={onResizePointerDown}
            onPointerMove={onResizePointerMove}
            onPointerUp={onResizePointerUp}
            onPointerCancel={onResizePointerUp}
            className="absolute left-0 top-0 z-20 h-full w-2 cursor-col-resize bg-transparent hover:bg-accent-primary/35"
          />
        )
      ) : null}

      <div
        className={cn(
          'relative z-10 flex shrink-0 items-center justify-between border-b border-border-subtle bg-bg-base px-2.5 py-1.5',
          detached && !narrow && 'copilot-drag-handle cursor-grab touch-none active:cursor-grabbing',
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          <span className="relative flex h-7 w-7 shrink-0 items-center justify-center rounded-sm border border-white/[0.08] bg-bg-sunken text-fg-muted">
            <Sparkles className="h-3.5 w-3.5" strokeWidth={2.25} />
          </span>
          <div className="min-w-0">
            <div className="truncate text-[12px] font-semibold leading-tight text-fg-primary">
              Pointer Co-Pilot
            </div>
            <div className="mt-0.5 flex flex-wrap items-center gap-1">
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded-sm border px-1.5 py-px text-[10px] font-medium tabular-nums',
                  copilotStatus === 'idle' && 'border-border-subtle bg-bg-sunken text-fg-muted',
                  copilotStatus === 'watching' && 'border-accent-primary/30 bg-accent-primary/5 text-accent-primary',
                  copilotStatus === 'armed' && 'border-signal-bull/30 bg-signal-bull/5 text-signal-bull',
                )}
              >
                <span
                  className={cn(
                    'h-1 w-1 rounded-full',
                    copilotStatus === 'idle' && 'bg-fg-muted',
                    copilotStatus === 'watching' && 'bg-accent-primary',
                    copilotStatus === 'armed' && 'bg-signal-bull',
                  )}
                  aria-hidden
                />
                {copilotStatus === 'idle'
                  ? 'Idle'
                  : copilotStatus === 'watching'
                    ? 'Watching'
                    : 'Armed'}
              </span>
            </div>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <span className="mr-0.5 hidden items-center rounded-sm border border-border-subtle p-0.5 sm:inline-flex">
            <button
              type="button"
              aria-label="Co-pilot as right panel"
              title="Panel layout"
              onClick={(e) => {
                e.stopPropagation();
                setDisplayMode('panel');
              }}
              className={cn(
                'focus-ring rounded-sm px-1.5 py-1',
                displayMode === 'panel'
                  ? 'bg-white/[0.06] text-fg-primary'
                  : 'text-fg-muted hover:text-fg-secondary',
              )}
            >
              <PanelRight className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              aria-label="Co-pilot as top pill"
              title="Pill layout"
              onClick={(e) => {
                e.stopPropagation();
                setDisplayMode('pill');
              }}
              className={cn(
                'focus-ring rounded-sm px-1.5 py-1',
                displayMode === 'pill'
                  ? 'bg-white/[0.06] text-fg-primary'
                  : 'text-fg-muted hover:text-fg-secondary',
              )}
            >
              <Pill className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          </span>
          <button
            type="button"
            aria-label="Move co-pilot back to top strip"
            title="Move to top"
            onClick={(e) => {
              e.stopPropagation();
              setCopilotMode('embedded');
              setOpen(false);
            }}
            className="focus-ring rounded-sm p-1.5 text-fg-muted hover:text-fg-secondary"
          >
            <ArrowUpToLine className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
          {!narrow ? (
            <button
              type="button"
              aria-label="Collapse co-pilot to icon rail"
              title="Collapse"
              onClick={(e) => {
                e.stopPropagation();
                setCollapsed(true);
              }}
              className="focus-ring rounded-sm p-1.5 text-fg-muted hover:text-fg-secondary"
            >
              <ChevronsRight className="h-3.5 w-3.5" strokeWidth={2.25} />
            </button>
          ) : null}
          <button
            type="button"
            aria-label={detached ? 'Dock co-pilot sidebar' : 'Float co-pilot window'}
            title={detached ? 'Dock to sidebar' : 'Detach floating panel'}
            onClick={(e) => {
              e.stopPropagation();
              setDetached(!detached);
            }}
            className="focus-ring rounded-sm p-1.5 text-fg-muted hover:text-fg-secondary"
          >
            <Settings2 className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            aria-label="Hide co-pilot"
            title="Close"
            onClick={(e) => {
              e.stopPropagation();
              setCopilotMode('minimized');
              setOpen(false);
            }}
            className="focus-ring rounded-sm p-1.5 text-fg-muted hover:text-fg-secondary"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </div>
      </div>

      <div
        className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        style={{
          backgroundColor: 'transparent',
          paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
        }}
      >
        <div className="flex flex-col gap-2 pb-2">
          <ContextCard entity={entity} />
          <AskBox entity={entity} />
          {alertRulesDocked ? null : alertRulesPopped ? (
            <AlertBuilderEmbeddedPlaceholder />
          ) : (
            <XMonitorCopilotCard />
          )}
          <AlertsTicker />
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-3 border-t border-border-subtle bg-bg-base px-2.5 py-1.5 text-[10px] text-fg-muted">
        <span className="inline-flex items-center gap-1 rounded-sm border border-signal-bull/30 bg-signal-bull/5 px-2 py-0.5 font-semibold tabular-nums text-signal-bull">
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inset-0 animate-ping rounded-full bg-signal-bull opacity-35" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-signal-bull" />
          </span>
          Stable
        </span>
        <span className="font-medium tabular-nums">US-E</span>
        <div className="ml-auto flex items-center gap-0.5 text-fg-muted">
          <span className="rounded p-1 opacity-70" title="Network">
            <Globe className="h-3 w-3" strokeWidth={2} />
          </span>
          <span className="rounded p-1 opacity-70" title="Support">
            <Headphones className="h-3 w-3" strokeWidth={2} />
          </span>
          <span className="rounded p-1 opacity-70" title="Activity">
            <Activity className="h-3 w-3" strokeWidth={2} />
          </span>
        </div>
      </div>
    </>
  );

  const floatingLayer =
    mounted && detached && open && !narrow
      ? createPortal(
          <aside
            ref={floatAsideRef}
            data-onboarding="copilot"
            className="relative flex min-h-0 flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-base shadow-[0_16px_40px_-16px_rgba(0,0,0,0.65)]"
            style={{
              position: 'fixed',
              zIndex: 260,
              top: floatTop,
              ...(copilotFloatUseLeftAnchor
                ? { left: floatLeft, right: 'auto' as const }
                : { right: floatRight, left: 'auto' as const }),
              width,
              height: floatHeightStyle,
              maxHeight:
                copilotFloatHeight != null
                  ? undefined
                  : `calc(100dvh - var(--app-topbar-h) - var(--app-bottombar-h))`,
            }}
            aria-label="AI co-pilot floating"
            onPointerDown={onFloatShellPointerDown}
            onPointerMove={onFloatShellPointerMove}
            onPointerUp={onFloatShellPointerUp}
            onPointerCancel={onFloatShellPointerUp}
          >
            <CopilotAlertsReadSync />
            {expandedBody}
            <div
              className="copilot-drag-handle pointer-events-auto absolute bottom-4 left-2 top-14 z-[38] w-3 cursor-grab touch-none rounded-sm hover:bg-white/[0.05] active:cursor-grabbing"
              title="Drag · left edge"
              aria-hidden
            />
            <div
              className="copilot-drag-handle pointer-events-auto absolute bottom-4 right-2 top-14 z-[38] w-3 cursor-grab touch-none rounded-sm hover:bg-white/[0.05] active:cursor-grabbing"
              title="Drag · right edge"
              aria-hidden
            />
            <CopilotFloatResizeChrome asideRef={floatAsideRef} />
          </aside>,
          document.body,
        )
      : null;

  // Pill-only layout is deprecated: it replaced this panel with `CopilotPillHost` and hid the
  // docked rail entirely, which broke the top-strip stack + Co-pilot toggle for most users.
  // Prefer embedded strip / dock — persisted `pill` prefs migrate to `panel` in the UI store merge.

  if (detached && open && !narrow) {
    return <>{floatingLayer}</>;
  }

  return (
    <>
      <aside
        data-onboarding="copilot"
        className={cn(
          'relative flex h-full min-h-0 flex-col bg-bg-base',
          copilotRailSide === 'left' ? 'border-r border-border-subtle' : 'border-l border-border-subtle',
          narrow
            ? cn(
                open
                  ? 'fixed inset-x-0 z-40 border-l-0 border-t shadow-[0_-12px_40px_rgba(0,0,0,0.55)]'
                  : 'hidden',
              )
            : cn('shrink-0', !open && 'overflow-hidden border-l-0'),
          open && !narrow && !collapsed ? 'items-stretch' : '',
        )}
            style={
          narrow && open
            ? {
                top: 'var(--app-topbar-h)',
                bottom: 'var(--app-bottombar-h)',
                width: '100%',
                maxWidth: '100%',
              }
            : {
                width: outerWidth,
                transition: panelResizing ? 'none' : `width ${PANEL_TRANSITION_MS}ms ease-out`,
              }
        }
        aria-label="AI co-pilot"
      >
        <CopilotAlertsReadSync />

        {open && collapsed && !narrow ? (
          <div className="flex h-full w-full flex-col items-center gap-1 bg-bg-base py-2">
            <div className="relative mt-1 flex w-8 shrink-0 items-center justify-center">
              {/* Same swallow mark as Topbar (`/branding/pointer-bird.png`). */}
              <img
                src="/branding/pointer-bird.png"
                alt=""
                width={28}
                height={28}
                decoding="async"
                className="h-7 w-auto shrink-0 object-contain opacity-90"
              />
              {unread > 0 ? (
                <span
                  className="absolute -right-0.5 -top-0.5 flex min-w-[15px] items-center justify-center rounded-full bg-signal-bear px-1 py-0.5 tabular-nums text-[8px] font-semibold leading-none text-fg-inverse"
                  aria-label={`${unread} new alerts`}
                >
                  {unread > 99 ? '99+' : unread}
                </span>
              ) : null}
            </div>

            <div className="min-h-2 flex-1" />

            <button
              type="button"
              aria-label="Expand co-pilot"
              onClick={() => setCollapsed(false)}
              className="btn-press focus-ring rounded-md p-1.5 text-fg-muted transition-all duration-150 hover:bg-bg-hover hover:text-fg-primary"
            >
              {copilotRailSide === 'left' ? (
                <ChevronsRight className="h-4 w-4" strokeWidth={2.25} />
              ) : (
                <ChevronsLeft className="h-4 w-4" strokeWidth={2.25} />
              )}
            </button>

            <button
              type="button"
              aria-label="Hide co-pilot"
              onClick={() => {
                setCopilotMode('minimized');
                setOpen(false);
              }}
              className="btn-press focus-ring rounded-md p-1 text-fg-muted transition-all duration-150 hover:bg-bg-hover hover:text-fg-primary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : null}

        {open && (!collapsed || narrow) ? expandedBody : null}
      </aside>
    </>
  );
}

export function CopilotToggleButton() {
  const displayMode = useUIStore((s) => s.copilotDisplayMode);
  const open = useUIStore((s) => s.panelOpen);
  const collapsed = useUIStore((s) => s.panelCollapsed);
  const setOpen = useUIStore((s) => s.setPanelOpen);
  const setCollapsed = useUIStore((s) => s.setPanelCollapsed);
  const setDetached = useUIStore((s) => s.setCopilotDetached);
  const setPillExpanded = useUIStore((s) => s.setCopilotPillExpanded);
  const { setMode: setCopilotMode } = useCopilotMode();

  const railExpanded = open && !collapsed;

  const label =
    displayMode === 'pill'
      ? 'Open co-pilot'
      : !open
        ? 'Show co-pilot'
        : collapsed
          ? 'Expand co-pilot'
          : 'Collapse co-pilot';

  const labelShort =
    displayMode === 'pill' ? 'Co-pilot' : !open ? 'Co-pilot' : collapsed ? 'Expand' : 'Collapse';

  return (
    <button
      type="button"
      onClick={() => {
        if (displayMode === 'pill') {
          setPillExpanded(true);
          return;
        }
        setDetached(false);
        if (!open) {
          setCopilotMode('minimized');
          setOpen(true);
          return;
        }
        if (collapsed) {
          setCollapsed(false);
        } else {
          setCollapsed(true);
        }
      }}
      aria-label={label}
      data-onboarding="copilot"
      className="btn-press focus-ring flex shrink-0 items-center gap-1 rounded-md border border-border-subtle bg-bg-base px-2 py-1 text-[11px] font-medium text-fg-secondary transition-all duration-150 hover:border-accent-primary/40 hover:text-fg-primary lg:px-2.5 lg:text-xs"
    >
      <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent-primary" strokeWidth={2.25} />
      <span className="hidden lg:inline">{labelShort}</span>
      <ChevronsRight
        className={cn('h-3 w-3 shrink-0 transition-transform duration-150', railExpanded && 'rotate-180')}
      />
    </button>
  );
}
