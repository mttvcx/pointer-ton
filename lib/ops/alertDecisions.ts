/**
 * Ops alert routing — pure decision + formatting logic (no I/O, unit-testable).
 * The dispatcher (Discord/Slack POST + Redis cooldown) lives in `alerts.ts`.
 *
 * Goal: page a human BEFORE users notice, without spamming. We alert on the same
 * threshold that auto-opens an incident (error / critical), deduped per incident
 * key with a severity-scaled cooldown so a flapping provider pings once per
 * window, not 100 times.
 */

import type { OpsEventSeverity, OpsEventStatus } from '@/lib/ops/events';

export type AlertEvent = {
  category: string;
  name: string;
  status: OpsEventStatus;
  severity: OpsEventSeverity;
  message?: string | null;
  detail?: Record<string, unknown>;
};

/** Alert on the incident threshold: an error status or an error/critical severity. */
export function shouldDispatch(status: OpsEventStatus, severity: OpsEventSeverity): boolean {
  return status === 'error' || severity === 'error' || severity === 'critical';
}

/** Per-key suppression window. Critical pages keep coming sooner; errors back off
 *  further so a noisy subsystem can't flood the channel. */
export function cooldownSeconds(severity: OpsEventSeverity): number {
  switch (severity) {
    case 'critical':
      return 5 * 60; // keep paging every 5m while it's on fire
    case 'error':
      return 15 * 60;
    default:
      return 30 * 60;
  }
}

/** Dedup key — one alert stream per incident (category:name) + severity. */
export function alertKey(category: string, name: string, severity: OpsEventSeverity): string {
  return `ops:alert:${category}:${name}:${severity}`;
}

/** Discord embed color (int) per severity. */
export function alertColor(severity: OpsEventSeverity): number {
  switch (severity) {
    case 'critical':
      return 0xef4444;
    case 'error':
      return 0xf59e0b;
    case 'warn':
      return 0xeab308;
    default:
      return 0x60a5fa;
  }
}

const EMOJI: Record<OpsEventSeverity, string> = {
  critical: '🚨',
  error: '⚠️',
  warn: '🟡',
  info: 'ℹ️',
};

/** Compact one-line title, e.g. "🚨 CRITICAL · provider:helius". */
export function alertTitle(ev: AlertEvent): string {
  return `${EMOJI[ev.severity]} ${ev.severity.toUpperCase()} · ${ev.category}:${ev.name}`;
}

/** Trim a detail object to a short, secret-free summary string for the body. */
export function summarizeDetail(detail: Record<string, unknown> | undefined, max = 280): string {
  if (!detail || Object.keys(detail).length === 0) return '';
  let s: string;
  try {
    s = JSON.stringify(detail);
  } catch {
    return '';
  }
  return s.length > max ? `${s.slice(0, max)}…` : s;
}

/** Provider-agnostic alert content — both Discord and Slack render from this. */
export function buildAlertPayload(ev: AlertEvent, appUrl?: string): {
  title: string;
  message: string;
  detail: string;
  color: number;
  opsUrl: string | null;
} {
  return {
    title: alertTitle(ev),
    message: (ev.message ?? '').slice(0, 500) || '(no message)',
    detail: summarizeDetail(ev.detail),
    color: alertColor(ev.severity),
    opsUrl: appUrl ? `${appUrl.replace(/\/$/, '')}/admin/ops` : null,
  };
}
