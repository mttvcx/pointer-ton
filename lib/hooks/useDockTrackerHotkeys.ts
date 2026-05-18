'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import {
  DOCK_TRACKER_HREF,
  DOCK_TRACKER_IDS,
  WALLET_HOTKEY_ROUTE,
} from '@/lib/dock/dockTrackerConfig';
import { useDockTrackersStore } from '@/store/dockTrackers';
import { useUIStore } from '@/store/ui';
import { useTokenDockPeekStore } from '@/store/tokenDockPeek';

function eventKeyToHotkey(e: KeyboardEvent): string {
  if (e.key === ' ') return 'Space';
  if (e.key.length === 1) return e.key.toUpperCase();
  return e.key;
}

export function useDockTrackerHotkeys() {
  const router = useRouter();
  const pathname = usePathname();
  const activeChain = useUIStore((s) => s.activeChain);
  const enabled = useDockTrackersStore((s) => s.hotkeysEnabled);
  const hotkeys = useDockTrackersStore((s) => s.hotkeys);
  const settingsOpen = useDockTrackersStore((s) => s.settingsOpen);

  useEffect(() => {
    if (!enabled || settingsOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest('input, textarea, select, [contenteditable], [role="dialog"]')) return;

      const needle = eventKeyToHotkey(e);
      const onPulsePage = pathname?.startsWith('/pulse') ?? false;

      for (const id of DOCK_TRACKER_IDS) {
        const hk = hotkeys[id];
        if (!hk || hk !== needle) continue;
        e.preventDefault();
        if (id === 'wallet') {
          router.push(WALLET_HOTKEY_ROUTE);
        } else if (id === 'tracker') {
          if (activeChain === 'sol' && !(pathname?.startsWith('/wallets'))) {
            useTokenDockPeekStore.getState().toggleWalletPeek();
          } else {
            router.push('/track');
          }
        } else if (id === 'pulse' && activeChain === 'sol' && !onPulsePage) {
          useTokenDockPeekStore.getState().togglePulsePeek();
        } else {
          const href = DOCK_TRACKER_HREF[id as keyof typeof DOCK_TRACKER_HREF];
          if (href) router.push(href);
        }
        return;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeChain, enabled, hotkeys, pathname, router, settingsOpen]);
}
