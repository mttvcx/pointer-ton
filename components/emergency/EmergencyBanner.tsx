'use client';

import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Info, Wrench } from 'lucide-react';

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

  if (!data) return null;

  // Maintenance is the strongest signal, then an explicit banner, then read-only.
  let content: { message: string; level: 'info' | 'warn' | 'critical' } | null = null;
  if (data.maintenance) {
    content = { message: 'Pointer is in maintenance — trading, AI and writes are paused. Read-only access is available.', level: 'critical' };
  } else if (data.banner) {
    content = data.banner;
  } else if (data.readOnly) {
    content = { message: 'Pointer is temporarily read-only — trading and writes are paused.', level: 'warn' };
  }
  if (!content) return null;

  const tone = TONE[content.level];
  const Icon = data.maintenance ? Wrench : tone.Icon;
  return (
    <div
      role="status"
      aria-live="polite"
      className={`flex w-full items-center justify-center gap-2 border-b px-4 py-1.5 text-[12px] font-medium ${tone.bg}`}
    >
      <Icon className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
      <span className="truncate">{content.message}</span>
    </div>
  );
}
