'use client';

import { useEffect, useState } from 'react';

/** Returns true after `delayMs` — defers non-critical work past first paint. */
export function useDeferredMount(delayMs = 1_500): boolean {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const run = () => setReady(true);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: delayMs });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, Math.min(delayMs, 800));
    return () => window.clearTimeout(t);
  }, [delayMs]);

  return ready;
}
