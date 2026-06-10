'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Monitor } from 'lucide-react';
import {
  FOUNDER_BETA_MIN_VIEWPORT_PX,
  isFounderBetaMode,
} from '@/lib/beta/founderBeta';

/**
 * Founder beta is desktop-first. On narrow viewports show an explicit gate
 * instead of a silently broken mobile layout.
 */
export function FounderBetaDesktopGate({ children }: { children: ReactNode }) {
  const enabled = isFounderBetaMode();
  const [tooNarrow, setTooNarrow] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    const mq = window.matchMedia(`(max-width: ${FOUNDER_BETA_MIN_VIEWPORT_PX - 1}px)`);
    const update = () => setTooNarrow(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [enabled]);

  if (!enabled || !tooNarrow) return <>{children}</>;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-bg-base px-6 py-10 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-border-subtle bg-bg-raised">
        <Monitor className="h-6 w-6 text-accent-primary" strokeWidth={1.75} />
      </div>
      <h1 className="mt-5 text-lg font-semibold text-fg-primary">Founder beta is desktop-only</h1>
      <p className="mt-2 max-w-md text-sm leading-relaxed text-fg-secondary">
        Pointer founder beta targets a desktop terminal layout ({FOUNDER_BETA_MIN_VIEWPORT_PX}px+ wide).
        Mobile support is not in scope for this beta — use a laptop or widen your browser window.
      </p>
      <p className="mt-4 text-[11px] text-fg-muted">
        Local testing: <span className="font-mono tabular-nums">http://localhost:3001</span>
      </p>
    </div>
  );
}
