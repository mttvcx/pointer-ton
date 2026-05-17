'use client';

import { useEffect, useRef, useState } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useAlertsTickerQuery } from '@/lib/hooks/useAlertsTicker';
import {
  POINTER_ALERT_UX_PREVIEW_EVT,
  type AlertUxPreviewDetail,
} from '@/lib/alerts/alertUxPreview';
import {
  ALERT_TYPE_ALERT_RULE,
  ALERT_TYPE_TWITTER_LISTEN,
} from '@/lib/alerts/alertRuleModel';
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
      if (a.type !== ALERT_TYPE_ALERT_RULE && a.type !== ALERT_TYPE_TWITTER_LISTEN) continue;
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

  useEffect(() => {
    let timeoutId: number | undefined;
    function onPreview(e: Event) {
      const ce = e as CustomEvent<AlertUxPreviewDetail>;
      const raw = ce.detail?.color ?? '#0077B6';
      const color = /^#[0-9A-Fa-f]{6}$/.test(raw) ? raw : '#7C5CFF';
      const opacity = ce.detail?.size === 'large' ? 0.22 : 0.12;
      requestAnimationFrame(() => {
        setFlash({ color, opacity });
        if (timeoutId !== undefined) window.clearTimeout(timeoutId);
        timeoutId = window.setTimeout(() => setFlash(null), 420);
      });
    }
    window.addEventListener(POINTER_ALERT_UX_PREVIEW_EVT, onPreview as EventListener);
    return () => {
      window.removeEventListener(POINTER_ALERT_UX_PREVIEW_EVT, onPreview as EventListener);
      if (timeoutId !== undefined) window.clearTimeout(timeoutId);
    };
  }, []);

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
