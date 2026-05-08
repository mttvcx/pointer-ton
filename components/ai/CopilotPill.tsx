'use client';

import { useEffect, useRef, useState } from 'react';
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
import { AlertRulesSection } from '@/components/alerts/AlertRulesSection';
import { AlertBuilderEmbeddedPlaceholder } from '@/components/alerts/AlertRulesPopoutHost';
import { cn } from '@/lib/utils/cn';

const CHROME = {
  card: '#11141b',
  border: '#202636',
  muted: '#7f8aa3',
  text: '#f5f7ff',
  accent: '#0077b6',
  cyan: '#34d5ff',
  bg: '#080d14',
} as const;

const PILL_TRANSITION_MS = 200;
const DRAG_THRESHOLD_PX = 6;

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
    <div className="relative h-[22px] min-w-0 flex-1 overflow-hidden px-2">
      {stack.prev ? (
        <p
          key={`out-${stack.prev.key}`}
          className="pointer-events-none absolute inset-x-2 top-0 line-clamp-1 text-left text-[12px] leading-snug text-fg-primary animate-copilot-pill-out"
          aria-hidden
        >
          {stack.prev.text}
        </p>
      ) : null}
      <p
        key={`in-${stack.cur.key}`}
        className={cn(
          'absolute inset-x-2 top-0 line-clamp-1 text-left text-[12px] leading-snug text-fg-primary',
          stack.prev ? 'animate-copilot-pill-in' : null,
        )}
      >
        {stack.cur.text}
      </p>
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
  const alertRulesAway =
    useUIStore((s) => s.alertRulesPopout != null || s.alertRulesDocked);

  return createPortal(
    <>
      <button
        type="button"
        aria-label="Dismiss co-pilot card"
        className="fixed inset-0 z-[625] cursor-default animate-in fade-in bg-black/25 backdrop-blur-[2px] duration-200"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal
        aria-label="AI co-pilot"
        className="fixed left-1/2 z-[630] flex max-h-[min(680px,calc(100dvh-var(--app-topbar-h)-var(--app-bottombar-h)-24px))] w-[min(720px,calc(100vw-20px))] -translate-x-1/2 animate-in fade-in zoom-in-95 flex-col overflow-hidden rounded-xl border border-white/10 bg-[#080d14]/95 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.55)] backdrop-blur-xl duration-200 ease-out"
        style={{
          top: 'calc(var(--app-topbar-h) + 10px)',
          borderColor: CHROME.border,
        }}
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
                backgroundColor: '#151924',
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
          className="flex min-h-0 flex-1 flex-col overflow-y-auto px-2 py-2"
          style={{
            backgroundColor: CHROME.bg,
            paddingBottom: 'max(10px, env(safe-area-inset-bottom))',
          }}
        >
          <div className="flex flex-col gap-2 pb-2">
            <ContextCard entity={entity} />
            <AskBox entity={entity} />
            {alertRulesAway ? (
              <AlertBuilderEmbeddedPlaceholder />
            ) : (
              <AlertRulesSection showPopoutLauncher />
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
    </>,
    document.body,
  );
}

/** Collapsed co-pilot control embedded in the top bar (pill layout mode). */
export function CopilotPillTopbarCollapsed() {
  const mode = useUIStore((s) => s.copilotDisplayMode);
  const expanded = useUIStore((s) => s.copilotPillExpanded);
  const setExpanded = useUIStore((s) => s.setCopilotPillExpanded);
  const offsetX = useUIStore((s) => s.copilotPillOffsetX);
  const setCopilotPillOffset = useUIStore((s) => s.setCopilotPillOffset);
  const hoveredEntity = useUIStore((s) => s.hoveredEntity);
  const lockedEntity = useUIStore((s) => s.lockedEntity);
  const searchOpen = useUIStore((s) => s.searchOpen);

  const { data: alertsData } = useAlertsTickerQuery();
  const insight = useCopilotPillInsight(alertsData);

  const [pillHover, setPillHover] = useState(false);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    ox: number;
    moved: boolean;
  } | null>(null);

  const busyElsewhere = Boolean(hoveredEntity || lockedEntity || searchOpen);
  const pillOpacity =
    expanded || pillHover ? 1 : busyElsewhere ? 0.42 : 0.72;

  if (mode !== 'pill' || expanded) return null;

  return (
    <div
      data-onboarding="copilot"
      className="flex w-full max-w-[min(420px,calc(100vw-16px))] touch-none justify-center"
      style={{
        transform: `translateX(${offsetX}px)`,
        opacity: pillOpacity,
        transition: dragging ? 'none' : `opacity ${PILL_TRANSITION_MS}ms ease`,
      }}
    >
      <div
        role="button"
        tabIndex={0}
        aria-label="Open or drag AI co-pilot"
        title="Drag horizontally · Click to open"
        className={cn(
          'pointer-events-auto flex h-9 w-full min-w-0 cursor-grab select-none items-center gap-2 rounded-full border border-white/10 bg-bg-base/90 px-3 shadow-md backdrop-blur-xl transition-[box-shadow,border-color,background-color] duration-200 active:cursor-grabbing hover:border-white/18 hover:bg-bg-base/95 hover:shadow-lg',
        )}
        onPointerEnter={() => setPillHover(true)}
        onPointerLeave={() => setPillHover(false)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setExpanded(true);
          }
        }}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          setDragging(false);
          dragRef.current = {
            pointerId: e.pointerId,
            startX: e.clientX,
            startY: e.clientY,
            ox: offsetX,
            moved: false,
          };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = dragRef.current;
          if (!d || e.pointerId !== d.pointerId) return;
          const dx = e.clientX - d.startX;
          if (Math.abs(dx) > DRAG_THRESHOLD_PX) {
            d.moved = true;
            setDragging(true);
            setCopilotPillOffset(d.ox + dx, 0);
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
          const shouldOpen = !d.moved;
          dragRef.current = null;
          setDragging(false);
          if (shouldOpen) setExpanded(true);
        }}
        onPointerCancel={(e) => {
          const d = dragRef.current;
          if (!d || e.pointerId !== d.pointerId) return;
          dragRef.current = null;
          setDragging(false);
        }}
      >
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border"
          style={{
            borderColor: `${CHROME.accent}44`,
            boxShadow: `0 0 12px -3px ${CHROME.accent}55`,
          }}
        >
          <Sparkles className="h-3.5 w-3.5 text-accent-primary" strokeWidth={2.25} />
        </span>
        <PillInsightCrossfade insight={insight} />
        <ChevronDown className="h-4 w-4 shrink-0 text-fg-muted" strokeWidth={2.25} aria-hidden />
      </div>
    </div>
  );
}

export function CopilotPillHost() {
  const mode = useUIStore((s) => s.copilotDisplayMode);
  const expanded = useUIStore((s) => s.copilotPillExpanded);
  const setExpanded = useUIStore((s) => s.setCopilotPillExpanded);
  const entity = useUIStore(selectActiveEntity);

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    queueMicrotask(() => setMounted(true));
  }, []);

  if (mode !== 'pill' || !mounted) return null;

  return (
    <>
      <CopilotPillAlertsSync />
      {expanded ? <CopilotPillExpandedCard onClose={() => setExpanded(false)} entity={entity} /> : null}
    </>
  );
}
