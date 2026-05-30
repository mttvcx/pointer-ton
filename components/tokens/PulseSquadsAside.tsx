'use client';

import { useRef } from 'react';
import { SquadsAsidePanel } from '@/components/squads/SquadsAsidePanel';
import { detachSquadsToFloat } from '@/lib/squads/openSquadsFloat';

/** Pulse side panel — squads chat rail (mirrors {@link PulseAlertsAside}). */
export function PulseSquadsAside({ dock }: { dock: 'left' | 'right' }) {
  const rootRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={rootRef} className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <SquadsAsidePanel
        embedded
        dock={dock}
        draggable
        onDragHandlePointerDown={() => {
          const r = rootRef.current?.getBoundingClientRect();
          detachSquadsToFloat(r ?? null);
        }}
      />
    </div>
  );
}
