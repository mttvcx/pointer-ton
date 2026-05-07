'use client';

import { useEffect, useState } from 'react';
import { isUiDemoMode, readUiDemoLocalStorage, uiDemoModeFromEnv, UI_DEMO_STORAGE_KEY } from '@/lib/dev/uiDemoMode';

/**
 * UI demo fixtures: env applies everywhere; localStorage applies after mount
 * (avoids SSR/client mismatch).
 */
export function useUiDemoMode(): boolean {
  const [on, setOn] = useState(() => uiDemoModeFromEnv());

  useEffect(() => {
    setOn(isUiDemoMode());
    function onStorage(e: StorageEvent) {
      if (e.key === UI_DEMO_STORAGE_KEY || e.key === null) {
        setOn(isUiDemoMode());
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return on;
}

/** Same-tab localStorage toggle (forces reload to pick up React Query cache). */
export function setUiDemoLocalStorage(enabled: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (enabled) window.localStorage.setItem(UI_DEMO_STORAGE_KEY, '1');
    else window.localStorage.removeItem(UI_DEMO_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

export function readUiDemoOverride(): boolean {
  return readUiDemoLocalStorage();
}
