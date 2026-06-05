'use client';

import { useEffect, useState } from 'react';

export type ConnectionStatus = 'stable' | 'degraded' | 'offline';

/**
 * Lightweight connectivity probe — pings tickers API for round-trip latency.
 */
export function useConnectionStatus(): ConnectionStatus {
  const [status, setStatus] = useState<ConnectionStatus>('stable');

  useEffect(() => {
    let cancelled = false;

    async function probe() {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        if (!cancelled) setStatus('offline');
        return;
      }
      const t0 = performance.now();
      try {
        const res = await fetch('/api/prices/tickers', { cache: 'no-store' });
        const ms = performance.now() - t0;
        if (!res.ok) {
          if (!cancelled) setStatus('degraded');
          return;
        }
        if (!cancelled) setStatus(ms > 900 ? 'degraded' : 'stable');
      } catch {
        if (!cancelled) setStatus('offline');
      }
    }

    void probe();
    const id = window.setInterval(() => void probe(), 30_000);
    window.addEventListener('online', probe);
    window.addEventListener('offline', () => setStatus('offline'));

    return () => {
      cancelled = true;
      window.clearInterval(id);
      window.removeEventListener('online', probe);
      window.removeEventListener('offline', () => setStatus('offline'));
    };
  }, []);

  return status;
}
