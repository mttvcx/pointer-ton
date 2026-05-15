'use client';

import { useCallback, useLayoutEffect, useRef, type PointerEvent as DomPointerEvent } from 'react';
import { PanelRight, X } from 'lucide-react';
import { AlertRulesSection } from '@/components/alerts/AlertRulesSection';
import {
  ALERT_DOCK_MAX_W,
  ALERT_DOCK_MIN_W,
  useUIStore,
} from '@/store/ui';

export function AlertRulesDockPanel() {
  const docked = useUIStore((s) => s.alertRulesDocked);
  const width = useUIStore((s) => s.alertRulesDockWidth);
  const setDocked = useUIStore((s) => s.setAlertRulesDocked);
  const setPopout = useUIStore((s) => s.setAlertRulesPopout);
  const setDockWidth = useUIStore((s) => s.setAlertRulesDockWidth);

  const resizeRef = useRef<{ pointerId: number; sx: number; sw: number } | null>(null);
  const clampedOnce = useRef(false);

  useLayoutEffect(() => {
    if (!docked) {
      clampedOnce.current = false;
      return;
    }
    if (clampedOnce.current) return;
    clampedOnce.current = true;
    const w = useUIStore.getState().alertRulesDockWidth;
    const c = Math.min(ALERT_DOCK_MAX_W, Math.max(ALERT_DOCK_MIN_W, w));
    if (c !== w) setDockWidth(c);
  }, [docked, setDockWidth]);

  const onResizePointerDown = useCallback(
    (e: DomPointerEvent<HTMLDivElement>) => {
      if (!docked || e.button !== 0) return;
      resizeRef.current = { pointerId: e.pointerId, sx: e.clientX, sw: width };
      e.currentTarget.setPointerCapture(e.pointerId);
    },
    [docked, width],
  );

  const onResizePointerMove = useCallback(
    (e: DomPointerEvent<HTMLDivElement>) => {
      const d = resizeRef.current;
      if (!d || e.pointerId !== d.pointerId) return;
      const next = Math.min(ALERT_DOCK_MAX_W, Math.max(ALERT_DOCK_MIN_W, d.sw + (e.clientX - d.sx)));
      setDockWidth(next);
    },
    [setDockWidth],
  );

  const onResizePointerUp = useCallback((e: DomPointerEvent<HTMLDivElement>) => {
    const d = resizeRef.current;
    if (!d || e.pointerId !== d.pointerId) return;
    resizeRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  if (!docked) return null;

  return (
    <aside
      aria-label="Alert builder docked"
      className="relative flex h-full min-h-0 shrink-0 flex-col border-r border-white/[0.07] bg-[rgba(8,13,20,0.42)] backdrop-blur-xl backdrop-saturate-150"
      style={{ width, minWidth: width, maxWidth: width }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize alert builder width"
        className="absolute right-0 top-0 z-20 h-full w-2 translate-x-1/2 cursor-col-resize bg-transparent hover:bg-accent-primary/30"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
      />
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.06] bg-gradient-to-b from-white/[0.06] to-transparent px-3 py-2 backdrop-blur-md"
      >
        <div className="min-w-0">
          <div className="truncate text-[11px] font-semibold text-fg-primary">Alert builder</div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            className="focus-ring rounded-md p-1.5 text-fg-muted hover:bg-white/5 hover:text-white"
            title="Detach to floating window"
            onClick={() => {
              setDocked(false);
              const header = document.querySelector('header');
              const top = Math.round((header?.getBoundingClientRect().bottom ?? 72) + 8);
              const w = Math.min(420, Math.max(280, Math.round(window.innerWidth * 0.32)));
              const h = Math.min(600, Math.max(320, window.innerHeight - top - 72));
              setPopout({ top, left: 16, width: w, height: h });
            }}
          >
            <PanelRight className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            className="focus-ring rounded-md p-1.5 text-fg-muted hover:bg-white/5 hover:text-white"
            title="Close dock"
            onClick={() => setDocked(false)}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2 pr-3">
        <AlertRulesSection embedInFloatingPanel />
      </div>
    </aside>
  );
}
