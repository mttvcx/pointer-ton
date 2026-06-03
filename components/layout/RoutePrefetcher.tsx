'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const PREFETCH_ROUTES = ['/pulse', '/portfolio', '/perps'] as const;

/** Warm common route JS after idle — never competes with logo/chain first paint. */
export function RoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
    const run = () => {
      for (const path of PREFETCH_ROUTES) {
        void router.prefetch(path);
      }
    };
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 12_000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 5_000);
    return () => window.clearTimeout(t);
  }, [router]);

  return null;
}
