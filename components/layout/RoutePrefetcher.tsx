'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const PREFETCH_ROUTES = ['/pulse', '/portfolio', '/explore'] as const;

/** Warm common route JS bundles on app mount so nav clicks feel instant. */
export function RoutePrefetcher() {
  const router = useRouter();

  useEffect(() => {
    for (const path of PREFETCH_ROUTES) {
      void router.prefetch(path);
    }
  }, [router]);

  return null;
}
