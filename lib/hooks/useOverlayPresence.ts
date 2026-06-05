'use client';

import { useEffect, useLayoutEffect, useState } from 'react';

const DEFAULT_EXIT_MS = 90;

/**
 * Keeps overlay DOM mounted after `open` becomes false so Tailwind exit animations
 * (`animate-out`, `fade-out`, `zoom-out-*`) can finish before unmount.
 */
export function useOverlayPresence(open: boolean, exitMs: number = DEFAULT_EXIT_MS) {
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);

  /** Enter before paint so dialogs never flash invisible or miss the first open frame. */
  useLayoutEffect(() => {
    if (open) {
      setMounted(true);
      setVisible(true);
    }
  }, [open]);

  useEffect(() => {
    if (open) return;

    setVisible(false);
    const t = window.setTimeout(() => setMounted(false), exitMs);
    return () => window.clearTimeout(t);
  }, [open, exitMs]);

  return { mounted, visible } as const;
}

export const OVERLAY_ANIM_CLOSE_MS = DEFAULT_EXIT_MS;
export const POPOVER_ANIM_CLOSE_MS = 90;
