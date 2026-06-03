'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';

const DeferredAppShellHosts = dynamic(
  () =>
    import('@/components/layout/DeferredAppShellHostsInner').then((m) => ({
      default: m.DeferredAppShellHosts,
    })),
  { ssr: false },
);

/** Mount deferred shell after idle — keeps initial route interactive. */
export function DeferredAppShellGate() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const run = () => setReady(true);
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(run, { timeout: 4_000 });
      return () => window.cancelIdleCallback(id);
    }
    const t = window.setTimeout(run, 800);
    return () => window.clearTimeout(t);
  }, []);

  if (!ready) return null;
  return <DeferredAppShellHosts />;
}
