'use client';

import { XMonitorPanel } from '@/components/monitor/XMonitorPanel';
import { detachXMonitorToFloat } from '@/lib/xMonitor/openXMonitorOnPulse';
import { useRef } from 'react';

/** Pulse side panel — unified full-height X monitor (feed + rules). */
export function PulseAlertsAside({ dock }: { dock: 'left' | 'right' }) {
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rootRef} className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <XMonitorPanel
        embedded
        dock={dock}
        draggable
        onDragHandlePointerDown={() => {
          const r = rootRef.current?.getBoundingClientRect();
          detachXMonitorToFloat(r ?? null);
        }}
      />
    </div>
  );
}
