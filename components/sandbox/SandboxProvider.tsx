'use client';

import { useEffect, useState } from 'react';
import { isSandboxMode, SANDBOX_MODE_EVENT, SANDBOX_LOCALSTORAGE_KEY } from '@/lib/sandbox/mode';
import { sandboxMarket } from '@/lib/sandbox/market';

/**
 * Reactive sandbox-enabled flag. Re-renders on runtime enable/disable
 * (same-tab custom event) and cross-tab storage changes.
 */
export function useSandboxEnabled(): boolean {
  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const sync = () => setEnabled(isSandboxMode());
    sync();
    const onStorage = (e: StorageEvent) => {
      if (e.key === SANDBOX_LOCALSTORAGE_KEY) sync();
    };
    window.addEventListener(SANDBOX_MODE_EVENT, sync);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(SANDBOX_MODE_EVENT, sync);
      window.removeEventListener('storage', onStorage);
    };
  }, []);

  return enabled;
}

/**
 * Starts/stops the simulated market engine while sandbox mode is active.
 * Renders nothing. Mounted once near the app root.
 */
export function SandboxProvider() {
  const enabled = useSandboxEnabled();

  useEffect(() => {
    if (!enabled) return;
    const market = sandboxMarket();
    market.start();
    return () => market.stop();
  }, [enabled]);

  return null;
}
