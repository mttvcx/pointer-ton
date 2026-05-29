'use client';

import { SquadsAsidePanel } from '@/components/squads/SquadsAsidePanel';

/** Pulse side panel — squads lobby rail (mirrors {@link PulseAlertsAside}). */
export function PulseSquadsAside({ dock }: { dock: 'left' | 'right' }) {
  return (
    <div className="flex h-full min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <SquadsAsidePanel dock={dock} />
    </div>
  );
}
