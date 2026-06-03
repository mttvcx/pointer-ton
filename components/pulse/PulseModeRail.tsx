'use client';

import { useEffect } from 'react';
import { PulseModeSelector } from '@/components/pulse/PulseModeSelector';
import { usePulseAssetModeStore } from '@/store/pulseAssetMode';
import { cn } from '@/lib/utils/cn';

/** Pulse / Stocks tabs only — no page title, demo badge, or disclaimer. */
export function PulseModeRail() {
  const mode = usePulseAssetModeStore((s) => s.mode);
  const hydrated = usePulseAssetModeStore((s) => s.hydrated);
  const setMode = usePulseAssetModeStore((s) => s.setMode);
  const hydrate = usePulseAssetModeStore((s) => s.hydrate);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  return (
    <div
      className={cn(
        'shrink-0 border-b border-white/[0.06] bg-bg-base',
        'pl-[max(var(--pulse-dock-pad-left,0px),var(--wallet-dock-pad-left,0px),var(--x-monitor-dock-pad-left,0px),var(--squads-dock-pad-left,0px))]',
        'pr-[max(var(--pulse-dock-pad-right,0px),var(--wallet-dock-pad-right,0px),var(--x-monitor-dock-pad-right,0px),var(--squads-dock-pad-right,0px))]',
      )}
    >
      <div className="flex h-9 min-h-9 flex-nowrap items-center px-2 sm:px-3 lg:px-4">
        {hydrated ? (
          <PulseModeSelector mode={mode} onChange={setMode} variant="label" />
        ) : (
          <span className="h-7 w-28 shrink-0 animate-pulse rounded-md bg-bg-hover" aria-hidden />
        )}
      </div>
    </div>
  );
}
