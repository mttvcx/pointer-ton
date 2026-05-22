'use client';

import { useCallback, useLayoutEffect, useRef, type PointerEvent as DomPointerEvent } from 'react';
import { PanelRight, X } from 'lucide-react';
import { XMonitorPanel } from '@/components/monitor/XMonitorPanel';
import { clampAlertRulesPopoutFrame } from '@/lib/ui/alertRulesPopoutFrame';
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
      aria-label="X monitor docked"
      className="relative flex h-full min-h-0 shrink-0 flex-col border-r border-white/[0.07] bg-bg-raised"
      style={{ width, minWidth: width, maxWidth: width }}
    >
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize X monitor width"
        className="absolute right-0 top-0 z-20 h-full w-2 translate-x-1/2 cursor-col-resize bg-transparent hover:bg-accent-primary/30"
        onPointerDown={onResizePointerDown}
        onPointerMove={onResizePointerMove}
        onPointerUp={onResizePointerUp}
        onPointerCancel={onResizePointerUp}
      />
      <div className="flex shrink-0 items-center justify-end gap-0.5 border-b border-white/[0.06] px-2 py-1">
        <button
          type="button"
          className="focus-ring rounded-sm p-1.5 text-fg-muted hover:bg-white/5 hover:text-fg-primary"
          title="Detach to floating window"
          onClick={() => {
            setDocked(false);
            const header = document.querySelector('header');
            const top = Math.round((header?.getBoundingClientRect().bottom ?? 72) + 8);
            const w = Math.min(420, Math.max(300, Math.round(window.innerWidth * 0.32)));
            const h = Math.min(window.innerHeight - top - 72, window.innerHeight - top - 48);
            setPopout(clampAlertRulesPopoutFrame(top, 16, w, h));
          }}
        >
          <PanelRight className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
        <button
          type="button"
          className="focus-ring rounded-sm p-1.5 text-fg-muted hover:bg-white/5 hover:text-fg-primary"
          title="Close dock"
          onClick={() => setDocked(false)}
        >
          <X className="h-3.5 w-3.5" strokeWidth={2.25} />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <XMonitorPanel embedded defaultTab="feed" />
      </div>
    </aside>
  );
}
