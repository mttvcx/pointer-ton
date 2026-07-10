'use client';

import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Info } from 'lucide-react';

type Status = {
  maintenance: boolean;
  readOnly: boolean;
  banner: { message: string; level: 'info' | 'warn' | 'critical' } | null;
};

const TONE: Record<'info' | 'warn' | 'critical', { bg: string; Icon: typeof Info }> = {
  info: { bg: 'bg-sky-500/15 text-sky-200 border-sky-500/30', Icon: Info },
  warn: { bg: 'bg-yellow-500/15 text-yellow-200 border-yellow-500/30', Icon: AlertTriangle },
  critical: { bg: 'bg-signal-bear/15 text-signal-bear border-signal-bear/40', Icon: AlertTriangle },
};

/**
 * Global emergency banner. Polls the public status endpoint and shows a strip at
 * the top of the app during maintenance / read-only / an admin-set banner.
 * Renders nothing in the normal case. Mounted once at the app-shell level.
 */
export function EmergencyBanner() {
  const { data } = useQuery({
    queryKey: ['emergency-status'],
    queryFn: async (): Promise<Status> => {
      const r = await fetch('/api/emergency/status');
      if (!r.ok) return { maintenance: false, readOnly: false, banner: null };
      return (await r.json()) as Status;
    },
    refetchInterval: 30_000,
    staleTime: 20_000,
    retry: false,
  });

  // Only show a banner the operator explicitly set (info/warn/critical). We do
  // NOT auto-synthesize a scary bar for maintenance / read-only / fail-closed —
  // those pause things server-side and surface a contextual message at the point
  // of action instead of alarming every visitor. (publicStatus already strips
  // the automatic fail-closed banner.)
  const content = data?.banner ?? null;

  const ref = useRef<HTMLDivElement | null>(null);
  const message = content?.message ?? null;
  // Publish the banner's height so fixed overlays (docks, hover cards, toasts,
  // copilot pill) can offset below it. 0 when no banner is shown.
  useEffect(() => {
    const root = document.documentElement;
    const h = message && ref.current ? ref.current.offsetHeight : 0;
    root.style.setProperty('--app-banner-h', `${h}px`);
    return () => {
      root.style.setProperty('--app-banner-h', '0px');
    };
  }, [message]);

  if (!content) return null;

  const tone = TONE[content.level];
  const Icon = tone.Icon;
  return (
    <div
      ref={ref}
      role="status"
      aria-live="polite"
      className={`flex w-full items-center justify-center gap-2 border-b px-4 py-1.5 text-[12px] font-medium ${tone.bg}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
      <span className="truncate">{content.message}</span>
    </div>
  );
}
