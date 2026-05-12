'use client';

import { useEffect } from 'react';
import { installClientErrorListeners } from '@/lib/reports/clientErrorRing';

/** Mount once in shell — attaches window error/unhandled listeners for diagnostics ring buffer only. */
export function ClientBugDiagnosticsBootstrap() {
  useEffect(() => {
    installClientErrorListeners();
  }, []);
  return null;
}
