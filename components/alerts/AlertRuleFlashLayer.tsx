'use client';

import { useEffect, useRef, useState } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useAlertsTickerQuery } from '@/lib/hooks/useAlertsTicker';
import { ALERT_TYPE_ALERT_RULE } from '@/lib/alerts/alertRuleModel';
import { cn } from '@/lib/utils/cn';

type FlashPayload = {
  enabled?: boolean;
  color?: string;
  size?: string;
};

function readFlashFromPayload(payload: unknown): FlashPayload | null {
  if (!payload || typeof payload !== 'object') return null;
  const flash = (payload as { flash?: unknown }).flash;
  if (!flash || typeof flash !== 'object') return null;
  return flash as FlashPayload;
}

/**
 * Brief full-viewport tint when a new `alert_rule` row appears (per session tracking).
 */
export function AlertRuleFlashLayer() {
  const { authenticated } = usePointerAuth();
  const { data } = useAlertsTickerQuery();
  const seenIds = useRef<Set<string>>(new Set());
  const hydrated = useRef(false);
  const [flash, setFlash] = useState<{ color: string; opacity: number } | null>(null);

  useEffect(() => {
    if (!authenticated || !data) return;

    if (!hydrated.current) {
      for (const a of data) seenIds.current.add(a.id);
      hydrated.current = true;
      return;
    }

    let rafId: number | null = null;
    let timeoutId: number | undefined;
    for (const a of data) {
      if (seenIds.current.has(a.id)) continue;
      seenIds.current.add(a.id);
      if (a.type !== ALERT_TYPE_ALERT_RULE) continue;
      const f = readFlashFromPayload(a.payload);
      if (f?.enabled === false) continue;
      const color = f?.color && /^#[0-9A-Fa-f]{6}$/.test(f.color) ? f.color : '#7C5CFF';
      const opacity = f?.size === 'large' ? 0.22 : 0.12;
      rafId = requestAnimationFrame(() => {
        setFlash({ color, opacity });
        timeoutId = window.setTimeout(() => setFlash(null), 420);
      });
      break;
    }
    return () => {
      if (rafId != null) cancelAnimationFrame(rafId);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, [authenticated, data]);

  if (!flash) return null;

  return (
    <div
      aria-hidden
      className={cn('pointer-events-none fixed inset-0 z-[300] transition-opacity duration-200')}
      style={{
        backgroundColor: flash.color,
        opacity: flash.opacity,
      }}
    />
  );
}
