'use client';

import { useEffect, useState } from 'react';

const DEFAULT_EXIT_MS = 220;

/**
 * Keeps overlay DOM mounted after `open` becomes false so Tailwind exit animations
 * (`animate-out`, `fade-out`, `zoom-out-*`) can finish before unmount.
 */
export function useOverlayPresence(open: boolean, exitMs: number = DEFAULT_EXIT_MS) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(id);
    }

    setVisible(false);
    const t = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);

  return { mounted, visible } as const;
}

export const OVERLAY_ANIM_CLOSE_MS = DEFAULT_EXIT_MS;
export const POPOVER_ANIM_CLOSE_MS = 220;
