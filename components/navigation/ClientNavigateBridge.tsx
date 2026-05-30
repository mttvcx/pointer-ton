'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { closeSquadsRail } from '@/lib/squads/openSquadsOnPulse';
import {
  POINTER_CLIENT_NAV_EVT,
  type ClientNavigateDetail,
} from '@/lib/navigation/clientNavigate';

/** Listens for `requestClientNavigate` and closes Pulse-only rails when leaving `/pulse`. */
export function ClientNavigateBridge() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const onNav = (e: Event) => {
      const detail = (e as CustomEvent<ClientNavigateDetail>).detail;
      if (!detail?.path) return;
      if (detail.replace) router.replace(detail.path);
      else router.push(detail.path);
    };
    window.addEventListener(POINTER_CLIENT_NAV_EVT, onNav);
    return () => window.removeEventListener(POINTER_CLIENT_NAV_EVT, onNav);
  }, [router]);

  useEffect(() => {
    if (pathname?.startsWith('/pulse')) return;
    closeSquadsRail();
  }, [pathname]);

  return null;
}
