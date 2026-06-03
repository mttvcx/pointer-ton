'use client';

import { useEffect, useState } from 'react';
import { championshipDemoDataEnabled } from '@/lib/championship/mode';
import { isUiDemoMode, readUiDemoLocalStorage, uiDemoModeFromEnv, UI_DEMO_STORAGE_KEY } from '@/lib/dev/uiDemoMode';

/**
 * Championship demo fixtures: env `NEXT_PUBLIC_CHAMPIONSHIP_DEMO` or UI demo mode.
 */
export function useChampionshipDemoMode(): boolean {
  const [on, setOn] = useState(() => championshipDemoDataEnabled());

  useEffect(() => {
    const sync = () => setOn(championshipDemoDataEnabled());
    const raf = requestAnimationFrame(sync);
    function onStorage(e: StorageEvent) {
      if (e.key === UI_DEMO_STORAGE_KEY || e.key === 'NEXT_PUBLIC_CHAMPIONSHIP_DEMO' || e.key === null) {
        sync();
      }
    }
    window.addEventListener('storage', onStorage);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return on;
}

export { uiDemoModeFromEnv, readUiDemoLocalStorage, isUiDemoMode };
