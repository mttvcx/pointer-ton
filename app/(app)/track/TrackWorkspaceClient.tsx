'use client';

import { useEffect, useState } from 'react';
import type { KolHandleRow } from '@/lib/track/kolHandlesLocal';
import { readStoredKolRows } from '@/lib/track/kolHandlesLocal';
import { TrackOperatingSystem } from '@/components/track/TrackOperatingSystem';
import { TrackersPanel } from '@/components/trackers/TrackersPanel';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui';

type TrackWorkspaceMode = 'hub' | 'engine';

export function TrackWorkspaceClient() {
  const activeChain = useUIStore((s) => s.activeChain);

  const [handles, setHandles] = useState<KolHandleRow[]>(() => readStoredKolRows(activeChain));
  const [mode, setMode] = useState<TrackWorkspaceMode>('hub');

  useEffect(() => {
    function onKolMutation() {
      setHandles(readStoredKolRows(useUIStore.getState().activeChain));
    }

    queueMicrotask(() => {
      setHandles(readStoredKolRows(activeChain));
    });

    window.addEventListener('storage', onKolMutation);
    window.addEventListener('pointer-kol-rows-updated', onKolMutation);

    return () => {
      window.removeEventListener('storage', onKolMutation);
      window.removeEventListener('pointer-kol-rows-updated', onKolMutation);
    };
  }, [activeChain]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center gap-2 rounded-xl border border-border-subtle bg-bg-raised px-1 py-1">
        <div className="flex gap-0.5 rounded-lg bg-bg-sunken/80 p-0.5">
          <button
            type="button"
            onClick={() => setMode('hub')}
            className={cn(
              'rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition',
              mode === 'hub'
                ? 'bg-accent-primary/20 text-fg-primary shadow-sm'
                : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
            )}
          >
            Hub
          </button>
          <button
            type="button"
            onClick={() => setMode('engine')}
            className={cn(
              'rounded-md px-3 py-1.5 text-[11px] font-semibold uppercase tracking-wide transition',
              mode === 'engine'
                ? 'bg-accent-primary/20 text-fg-primary shadow-sm'
                : 'text-fg-muted hover:bg-bg-hover hover:text-fg-secondary',
            )}
          >
            Automation
          </button>
        </div>
        <p className="hidden min-w-0 flex-1 text-[10px] leading-snug text-fg-muted sm:block">
          Hub is wallets + X tracked accounts (same as the dock Social shortcut). Automation is rules, alerts, and
          history.
        </p>
      </div>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        {mode === 'hub' ? (
          <TrackersPanel className="min-h-0 flex-1" surface="track_hub" />
        ) : (
          <TrackOperatingSystem kolHandlesPreview={handles} />
        )}
      </div>
    </div>
  );
}
