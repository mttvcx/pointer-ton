'use client';

import { useEffect, useState } from 'react';
import type { KolHandleRow } from '@/lib/track/kolHandlesLocal';
import { readStoredKolRows } from '@/lib/track/kolHandlesLocal';
import { useUIStore } from '@/store/ui';
import { TrackOperatingSystem } from '@/components/track/TrackOperatingSystem';

export function TrackWorkspaceClient() {
  const activeChain = useUIStore((s) => s.activeChain);

  const [handles, setHandles] = useState<KolHandleRow[]>([]);
  useEffect(() => {
    setHandles(readStoredKolRows(activeChain));

    function onKolMutation() {
      setHandles(readStoredKolRows(useUIStore.getState().activeChain));
    }

    window.addEventListener('storage', onKolMutation);
    window.addEventListener('pointer-kol-rows-updated', onKolMutation);

    return () => {
      window.removeEventListener('storage', onKolMutation);
      window.removeEventListener('pointer-kol-rows-updated', onKolMutation);
    };
  }, [activeChain]);

  return <TrackOperatingSystem kolHandlesPreview={handles} />;
}
