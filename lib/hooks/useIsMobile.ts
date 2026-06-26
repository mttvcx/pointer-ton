'use client';

import { useEffect, useState } from 'react';

/**
 * True below the desktop layout breakpoint. The terminal's multi-column chrome
 * (3 Pulse columns, side copilot rails, the dock status bar) only fits from
 * `lg` up, so that's the line where we swap to mobile chrome: compact topbar,
 * ☰ drawer, bottom tab nav, single-column Pulse.
 *
 * SSR-safe: starts `false` (desktop-first markup) and resolves on mount, so the
 * server render and first client paint agree — then matchMedia keeps it live on
 * resize / orientation change.
 */
const MOBILE_MAX_WIDTH = 1023; // < Tailwind `lg` (1024px)

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_MAX_WIDTH}px)`);
    const update = () => setIsMobile(mql.matches);
    update();
    mql.addEventListener('change', update);
    return () => mql.removeEventListener('change', update);
  }, []);

  return isMobile;
}
