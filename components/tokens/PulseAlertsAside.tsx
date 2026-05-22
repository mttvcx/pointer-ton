'use client';

import { useCallback, useRef } from 'react';
import { XMonitorPanel } from '@/components/monitor/XMonitorPanel';
import { openXMonitorFloat } from '@/lib/xMonitor/openXMonitorFloat';
import { useTokenDockPeekStore } from '@/store/tokenDockPeek';

const DETACH_DRAG_PX = 10;

/** Pulse side panel — unified X monitor (feed + rules), detachable via header grabber. */
export function PulseAlertsAside({ dock }: { dock: 'left' | 'right' }) {
  const asideRef = useRef<HTMLDivElement | null>(null);
  const floatOpen = useTokenDockPeekStore((s) => s.xMonitorPeekOpen);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    detached: boolean;
  } | null>(null);

  const onGripPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      detached: false,
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, []);

  const onGripPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId || d.detached) return;
    const dist = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
    if (dist < DETACH_DRAG_PX) return;
    d.detached = true;
    openXMonitorFloat(asideRef.current?.getBoundingClientRect() ?? null);
  }, []);

  const onGripPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
  }, []);

  if (floatOpen) return null;

  return (
    <div
      ref={asideRef}
      className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden"
    >
      <XMonitorPanel
        embedded
        dock={dock}
        draggable
        onDragHandlePointerDown={onGripPointerDown}
        onDragHandlePointerMove={onGripPointerMove}
        onDragHandlePointerUp={onGripPointerUp}
      />
    </div>
  );
}
