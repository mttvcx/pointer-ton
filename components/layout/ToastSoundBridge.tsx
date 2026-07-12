'use client';

import { useEffect } from 'react';
import { playAppSound } from '@/lib/sound/appSounds';

/**
 * Plays the configured "App notifications" sound whenever a new Sonner toast
 * mounts — a global bridge so every existing `toast.*` call gets audio without
 * touching call sites. Watches the toaster container for added `[data-sonner-toast]`
 * nodes and debounces bursts so a batch of toasts is a single chime.
 *
 * Off by default (the `toast` event ships disabled) — opt in via Settings → Sounds.
 */
export function ToastSoundBridge() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    let lastPlay = 0;
    const fire = () => {
      const now = performance.now();
      if (now - lastPlay < 250) return; // debounce toast bursts
      lastPlay = now;
      void playAppSound('toast');
    };

    const isToast = (n: Node): boolean =>
      n instanceof HTMLElement &&
      (n.hasAttribute('data-sonner-toast') || !!n.querySelector?.('[data-sonner-toast]'));

    const observer = new MutationObserver((records) => {
      for (const rec of records) {
        for (const node of rec.addedNodes) {
          if (isToast(node)) {
            fire();
            return;
          }
        }
      }
    });

    // The toaster may mount after us; poll briefly for its container, then observe.
    let tries = 0;
    const attach = () => {
      const toaster = document.querySelector('[data-sonner-toaster]');
      if (toaster) {
        observer.observe(toaster, { childList: true, subtree: true });
        return;
      }
      if (tries++ < 40) window.setTimeout(attach, 250);
    };
    attach();

    return () => observer.disconnect();
  }, []);

  return null;
}
