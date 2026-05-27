'use client';

import { useCallback, useEffect, useRef, useState, type HTMLAttributes } from 'react';
import { createPortal } from 'react-dom';
import {
  Activity,
  ChevronDown,
  Globe,
  Headphones,
  PanelRight,
  Pill,
  Sparkles,
  X,
} from 'lucide-react';
import {
  computeCopilotAlertsReadIso,
  selectActiveEntity,
  useUIStore,
} from '@/store/ui';
import { useAlertsTickerQuery } from '@/lib/hooks/useAlertsTicker';
import { useCopilotPillInsight } from '@/lib/hooks/useCopilotPillInsight';
import { ContextCard } from '@/components/ai/ContextCard';
import { AskBox } from '@/components/ai/AskBox';
import { XMonitorCopilotCard } from '@/components/monitor/XMonitorCopilotCard';
import { AlertBuilderEmbeddedPlaceholder } from '@/components/alerts/AlertRulesPopoutHost';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';
import { cn } from '@/lib/utils/cn';

const CHROME = {
  card: 'rgba(17, 20, 27, 0.45)',
  border: 'rgba(255, 255, 255, 0.1)',
  muted: '#7f8aa3',
  text: '#f5f7ff',
  accent: '#0077b6',
  cyan: '#34d5ff',
  bg: 'rgba(8, 13, 20, 0.48)',
} as const;

const PILL_TRANSITION_MS = 200;

const HEADER_DRAG_MAX_X = 150;
const HEADER_DRAG_MAX_Y = 8;
const DRAG_IGNORER_CLICK_PX = 10;
const DETACH_DRAG_DOWN_PX = 36;

function headerBottomPx(): number {
  if (typeof document === 'undefined') return 72;
  const h = document.querySelector('header');
  if (!h) return 72;
  const r = h.getBoundingClientRect();
  return r.bottom > 0 ? r.bottom : 72;
}

function CopilotPillAlertsSync() {
  const expanded = useUIStore((s) => s.copilotPillExpanded);
  const lastRead = useUIStore((s) => s.lastCopilotAlertsReadAt);
  const markRead = useUIStore((s) => s.markCopilotAlertsRead);
  const { data } = useAlertsTickerQuery();

  useEffect(() => {
    if (!data?.length || !expanded) return;
    const nextIso = computeCopilotAlertsReadIso(data);
    const prevT = lastRead ? new Date(lastRead).getTime() : 0;
    if (new Date(nextIso).getTime() <= prevT) return;
    markRead(data);
  }, [data, expanded, lastRead, markRead]);

  return null;
}

function PillInsightCrossfade({ insight }: { insight: ReturnType<typeof useCopilotPillInsight> }) {
  const [stack, setStack] = useState<{ cur: typeof insight; prev: typeof insight | null }>({
    cur: insight,
    prev: null,
  });

  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (cancelled) return;
      setStack((s) => {
        if (s.cur.key === insight.key && s.cur.text === insight.text) return s;
        return { cur: insight, prev: s.cur };
      });
    });
    return () => {
      cancelled = true;
    };
  }, [insight.key, insight.text]);

  useEffect(() => {
    if (!stack.prev) return;
    const t = window.setTimeout(() => {
      setStack((s) => ({ ...s, prev: null }));
    }, PILL_TRANSITION_MS);
    return () => window.clearTimeout(t);
  }, [stack.prev?.key]);

  return (
    // pointer-events-none on the whole insight area: text is purely
    // presentational — clicks must reach the parent shell's onClick (drag /
    // expand handlers) regardless of where the cursor lands inside the pill.
    <div className="pointer-events-none flex min-h-0 min-w-0 flex-1 items-stretch self-stretch overflow-hidden px-2">
      <div className="relative min-h-0 min-w-0 flex-1">
        {stack.prev ? (
          <div
            key={`out-${stack.prev.key}`}
            className="pointer-events-none absolute inset-x-0 top-0 bottom-0 flex items-center animate-copilot-pill-out"
            aria-hidden
          >
            <p className="line-clamp-1 w-full text-left text-[12px] leading-[1.35] text-fg-primary">{stack.prev.text}</p>
          </div>
        ) : null}
        <div
          key={`in-${stack.cur.key}`}
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 bottom-0 flex items-center',
            stack.prev ? 'animate-copilot-pill-in' : null,
          )}
        >
          <p className="line-clamp-1 w-full text-left text-[12px] leading-[1.35] text-fg-primary">{stack.cur.text}</p>
        </div>
      </div>
    </div>
  );
}

function CopilotPillExpandedCard({
  onClose,
  entity,
}: {
  onClose: () => void;
  entity: ReturnType<typeof selectActiveEntity>;
}) {
  const setMode = useUIStore((s) => s.setCopilotDisplayMode);
  const xMonitorOpen = usePulseTwitterRailStore((s) => s.side !== 'hidden');
  const { data: alertsData } = useAlertsTickerQuery();
  const pillInsight = useCopilotPillInsight(alertsData);

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Dismiss co-pilot card"
        className="fixed inset-0 z-[625] cursor-default animate-in fade-in duration-300 bg-black/30 backdrop-blur-[3px]"
        onClick={onClose}
      />
      <div
        className="pointer-events-none fixed left-1/2 z-[630] w-[min(720px,calc(100vw-20px))] -translate-x-1/2"
        style={{ top: 'calc(var(--app-topbar-h) + 10px)' }}
      >
        <div
          role="dialog"
          aria-modal
          aria-label="AI co-pilot"
          className={cn(
            'pointer-events-auto flex max-h-[min(680px,calc(100dvh-var(--app-topbar-h)-var(--app-bottombar-h)-24px))] w-full flex-col overflow-hidden rounded-xl border bg-[rgba(8,13,20,0.48)] backdrop-blur-2xl backdrop-saturate-150',
            'animate-copilot-card-enter border-white/14',
            'shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_0_36px_-8px_rgba(255,255,255,0.16),0_28px_52px_-14px_rgba(0,0,0,0.58)]',
          )}
          style={{ borderColor: CHROME.border }}
          onClick={(e) => e.stopPropagation()}
        >
        <div
          className="flex shrink-0 items-center justify-between border-b px-3 py-2"
          style={{ borderColor: CHROME.border, background: `linear-gradient(180deg, ${CHROME.card} 0%, ${CHROME.bg} 100%)` }}
        >
          <div className="flex min-w-0 items-center gap-2">
            <span
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border"
              style={{
                borderColor: `${CHROME.accent}55`,
                boxShadow: `0 0 16px -4px ${CHROME.accent}66`,
                backgroundColor: 'rgba(21, 25, 36, 0.55)',
              }}
            >
              <Sparkles className="h-4 w-4" style={{ color: CHROME.cyan }} strokeWidth={2.25} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-semibold" style={{ color: CHROME.text }}>
                Pointer Co-Pilot
              </div>
              <div className="mt-1 inline-flex rounded-md border p-0.5" style={{ borderColor: CHROME.border }}>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setMode('panel');
                  }}
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition hover:opacity-90"
                  style={{ color: CHROME.muted }}
                  title="Dock to right rail"
                >
                  <PanelRight className="h-3 w-3" />
                  Panel
                </button>
                <button
                  type="button"
                  className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition"
                  style={{
                    backgroundColor: `${CHROME.accent}22`,
                    color: CHROME.cyan,
                  }}
                  title="Top pill mode"
                >
                  <Pill className="h-3 w-3" />
                  Pill
                </button>
              </div>
            </div>
          </div>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="focus-ring rounded-md p-1.5"
            style={{ color: CHROME.muted }}
          >
            <X className="h-4 w-4" strokeWidth={2.25} />
          </button>
        </div>

        <div
          className="flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain px-2 py-2"
          style={{
            backgroundColor: 'transparent',
            paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          }}
        >
          <div className="flex flex-col gap-2 pb-2">
            <div
              className="rounded-lg border px-2.5 py-2"
              style={{ borderColor: `${CHROME.border}`, backgroundColor: 'rgba(15, 18, 24, 0.52)' }}
            >
              <div className="text-[10px] font-semibold uppercase tracking-wide" style={{ color: CHROME.muted }}>
                Live scan
              </div>
              <p className="mt-1 whitespace-pre-wrap break-words text-[12px] leading-snug" style={{ color: CHROME.text }}>
                {pillInsight.text}
              </p>
            </div>
            <ContextCard entity={entity} />
            <AskBox entity={entity} />
            {xMonitorOpen ? (
              <AlertBuilderEmbeddedPlaceholder />
            ) : (
              <XMonitorCopilotCard />
            )}
          </div>
        </div>

        <div
          className="flex shrink-0 items-center gap-3 border-t px-2.5 py-2 text-[10px]"
          style={{ borderColor: CHROME.border, backgroundColor: CHROME.card, color: CHROME.muted }}
        >
          <span className="font-medium tabular-nums">AI · alerts · rules</span>
          <div className="ml-auto flex items-center gap-0.5 opacity-70">
            <Globe className="h-3 w-3" strokeWidth={2} />
            <Headphones className="h-3 w-3" strokeWidth={2} />
            <Activity className="h-3 w-3" strokeWidth={2} />
          </div>
        </div>
        </div>
      </div>
    </>,
    document.body,
  );
}

/** Collapsed pill control: insight strip + chrome (shared header + floating). */
function CopilotPillCollapsedSurface({
  insight,
  pillHover,
  setPillHover,
  shellProps,
}: {
  insight: ReturnType<typeof useCopilotPillInsight>;
  pillHover: boolean;
  setPillHover: (v: boolean) => void;
  shellProps: Pick<
    HTMLAttributes<HTMLDivElement>,
    | 'className'
    | 'style'
    | 'onPointerDown'
    | 'onPointerMove'
    | 'onPointerUp'
    | 'onPointerCancel'
    | 'onClick'
    | 'onPointerEnter'
    | 'onPointerLeave'
    | 'onKeyDown'
  >;
}) {
  const busyElsewhere = useUIStore(
    (s) => Boolean(s.hoveredEntity || s.lockedEntity || s.searchOpen),
  );
  const expanded = useUIStore((s) => s.copilotPillExpanded);
  const pillOpacity = expanded || pillHover ? 1 : busyElsewhere ? 0.42 : 0.72;

  return (
    <div
      data-onboarding="copilot"
      className="pointer-events-auto flex w-full max-w-[min(420px,calc(100vw-16px))] justify-center"
      style={{
        opacity: pillOpacity,
        transition: `opacity ${PILL_TRANSITION_MS}ms ease`,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="Open AI co-pilot. Drag sideways in the header, or drag down to tear off."
        title="Open co-pilot · drag to reposition"
        className={cn(
          'flex h-9 w-full min-w-0 touch-none select-none items-stretch gap-2 rounded-full border py-0 pl-2.5 pr-2 shadow-md backdrop-blur-xl transition-[box-shadow,border-color,background-color,transform] duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent-primary/38',
          pillHover
            ? 'border-white/22 bg-bg-base/95 shadow-[0_0_32px_-8px_rgba(255,255,255,0.28),0_0_14px_-2px_rgba(255,255,255,0.12)]'
            : 'border-white/10 bg-bg-base/90 hover:border-white/18 hover:bg-bg-base/95 hover:shadow-[0_0_22px_-8px_rgba(255,255,255,0.18)]',
          shellProps.className,
        )}
        style={shellProps.style}
        onPointerEnter={(e) => {
          setPillHover(true);
          shellProps.onPointerEnter?.(e);
        }}
        onPointerLeave={(e) => {
          setPillHover(false);
          shellProps.onPointerLeave?.(e);
        }}
        onPointerDown={shellProps.onPointerDown}
        onPointerMove={shellProps.onPointerMove}
        onPointerUp={shellProps.onPointerUp}
        onPointerCancel={shellProps.onPointerCancel}
        onKeyDown={(e) => {
          shellProps.onKeyDown?.(e);
          if (e.defaultPrevented) return;
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            useUIStore.getState().setCopilotPillExpanded(true);
          }
        }}
        onClick={shellProps.onClick}
      >
        <span
          className="flex h-7 w-7 shrink-0 self-center items-center justify-center rounded-full border"
          style={{
            borderColor: `${CHROME.accent}44`,
            boxShadow: `0 0 12px -3px ${CHROME.accent}55`,
          }}
        >
          <Sparkles className="h-3.5 w-3.5 text-accent-primary" strokeWidth={2.25} />
        </span>
        <PillInsightCrossfade insight={insight} />
        <ChevronDown className="h-4 w-4 shrink-0 self-center text-fg-muted" strokeWidth={2.25} aria-hidden />
      </div>
    </div>
  );
}

/** Collapsed co-pilot control embedded in the top bar (pill layout mode). */
export function CopilotPillTopbarCollapsed() {
  const mode = useUIStore((s) => s.copilotDisplayMode);
  const expanded = useUIStore((s) => s.copilotPillExpanded);
  const anchor = useUIStore((s) => s.copilotPillAnchor);
  const offsetX = useUIStore((s) => s.copilotPillOffsetX);
  const offsetY = useUIStore((s) => s.copilotPillOffsetY);
  const setOffset = useUIStore((s) => s.setCopilotPillOffset);
  const setAnchor = useUIStore((s) => s.setCopilotPillAnchor);
  const setFreePos = useUIStore((s) => s.setCopilotPillFreePos);

  const { data: alertsData } = useAlertsTickerQuery();
  const insight = useCopilotPillInsight(alertsData);

  const [pillHover, setPillHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    id: number;
    cx: number;
    cy: number;
    ox: number;
    oy: number;
  } | null>(null);
  const didDragRef = useRef(false);
  const pillWrapRef = useRef<HTMLDivElement | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      didDragRef.current = false;
      setDragging(true);
      dragRef.current = {
        id: e.pointerId,
        cx: e.clientX,
        cy: e.clientY,
        ox: offsetX,
        oy: offsetY,
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [offsetX, offsetY],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.cx;
      const dy = e.clientY - d.cy;
      if (Math.hypot(dx, dy) > DRAG_IGNORER_CLICK_PX) didDragRef.current = true;

      if (
        didDragRef.current &&
        dy > DETACH_DRAG_DOWN_PX &&
        e.clientY > headerBottomPx() + 2
      ) {
        const rect = pillWrapRef.current?.getBoundingClientRect();
        const w = rect?.width ?? 260;
        setAnchor('free');
        setFreePos(e.clientX - w / 2, e.clientY - 14);
        dragRef.current = null;
        setDragging(false);
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }
        return;
      }

      if (!didDragRef.current) return;

      setOffset(
        Math.min(HEADER_DRAG_MAX_X, Math.max(-HEADER_DRAG_MAX_X, d.ox + dx)),
        Math.min(HEADER_DRAG_MAX_Y, Math.max(-HEADER_DRAG_MAX_Y, d.oy + dy)),
      );
    },
    [setAnchor, setFreePos, setOffset],
  );

  const endDrag = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (d && e.pointerId === d.id) {
      dragRef.current = null;
      setDragging(false);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    }
  }, []);

  if (mode !== 'pill' || expanded || anchor !== 'header') return null;

  return (
    <div
      ref={pillWrapRef}
      className="flex w-full justify-center"
      style={{
        transform: `translate(${offsetX}px, ${offsetY}px)`,
        transition: dragging ? 'none' : 'transform 160ms ease-out',
      }}
    >
      <CopilotPillCollapsedSurface
        insight={insight}
        pillHover={pillHover}
        setPillHover={setPillHover}
        shellProps={{
          className: 'cursor-grab active:cursor-grabbing',
          onPointerDown,
          onPointerMove,
          onPointerUp: endDrag,
          onPointerCancel: endDrag,
          onClick: (ev) => {
            if (didDragRef.current) {
              ev.preventDefault();
              ev.stopPropagation();
              return;
            }
            useUIStore.getState().setCopilotPillExpanded(true);
          },
        }}
      />
    </div>
  );
}

function CopilotPillFreeFloat() {
  const mode = useUIStore((s) => s.copilotDisplayMode);
  const expanded = useUIStore((s) => s.copilotPillExpanded);
  const anchor = useUIStore((s) => s.copilotPillAnchor);
  const freeLeft = useUIStore((s) => s.copilotPillFreeLeft);
  const freeTop = useUIStore((s) => s.copilotPillFreeTop);
  const setFreePos = useUIStore((s) => s.setCopilotPillFreePos);
  const setAnchor = useUIStore((s) => s.setCopilotPillAnchor);
  const setOffset = useUIStore((s) => s.setCopilotPillOffset);

  const { data: alertsData } = useAlertsTickerQuery();
  const insight = useCopilotPillInsight(alertsData);

  const [pillHover, setPillHover] = useState(false);
  const dragRef = useRef<{ id: number; cx: number; cy: number; ol: number; ot: number } | null>(null);
  const didDragRef = useRef(false);
  const shellRef = useRef<HTMLDivElement | null>(null);

  const clampFree = useCallback((l: number, t: number) => {
    const el = shellRef.current;
    const w = el?.offsetWidth ?? 280;
    const h = el?.offsetHeight ?? 40;
    const maxL = Math.max(8, window.innerWidth - w - 8);
    const maxT = Math.max(8, window.innerHeight - h - 8);
    return {
      left: Math.min(maxL, Math.max(8, l)),
      top: Math.min(maxT, Math.max(8, t)),
    };
  }, []);

  const onPointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (e.button !== 0) return;
      didDragRef.current = false;
      dragRef.current = {
        id: e.pointerId,
        cx: e.clientX,
        cy: e.clientY,
        ol: freeLeft,
        ot: freeTop,
      };
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        /* ignore */
      }
    },
    [freeLeft, freeTop],
  );

  const onPointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.cx;
      const dy = e.clientY - d.cy;
      if (Math.hypot(dx, dy) > DRAG_IGNORER_CLICK_PX) didDragRef.current = true;
      if (!didDragRef.current) return;
      const next = clampFree(d.ol + dx, d.ot + dy);
      setFreePos(next.left, next.top);
    },
    [clampFree, setFreePos],
  );

  const onPointerUp = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const d = dragRef.current;
      if (d && e.pointerId === d.id) {
        dragRef.current = null;
        try {
          e.currentTarget.releasePointerCapture(e.pointerId);
        } catch {
          /* ignore */
        }

        const mid = window.innerWidth / 2;
        if (
          e.clientY <= headerBottomPx() + 16 &&
          Math.abs(e.clientX - mid) < Math.min(340, window.innerWidth * 0.38)
        ) {
          setAnchor('header');
          setOffset(0, 0);
        }
      }
    },
    [setAnchor, setOffset],
  );

  if (mode !== 'pill' || expanded || anchor !== 'free') return null;

  return createPortal(
    <div
      ref={shellRef}
      className="pointer-events-auto fixed z-[125] w-[min(420px,calc(100vw-24px))]"
      style={{ left: freeLeft, top: freeTop }}
    >
      <CopilotPillCollapsedSurface
        insight={insight}
        pillHover={pillHover}
        setPillHover={setPillHover}
        shellProps={{
          className: 'cursor-grab shadow-lg active:cursor-grabbing',
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerCancel: onPointerUp,
          onClick: (ev) => {
            if (didDragRef.current) {
              ev.preventDefault();
              ev.stopPropagation();
              return;
            }
            useUIStore.getState().setCopilotPillExpanded(true);
          },
        }}
      />
    </div>,
    document.body,
  );
}

/**
 * Pill host is now a thin wrapper around the alerts read-state sync only.
 * The collapsed bar + drop-down sheet are owned by `CopilotHeaderBar`
 * (rendered in the top bar in any mode), and the centered expanded modal /
 * draggable free-float surfaces are retired in the Cluely-style rehaul.
 */
export function CopilotPillHost() {
  const mode = useUIStore((s) => s.copilotDisplayMode);
  if (mode !== 'pill') return null;
  return <CopilotPillAlertsSync />;
}
