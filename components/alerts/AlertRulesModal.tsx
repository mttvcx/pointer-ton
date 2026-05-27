'use client';

import { openXMonitorOnPulse } from '@/lib/xMonitor/openXMonitorOnPulse';

/** Opens the Pulse side-rail X monitor (single canonical surface). */
export function openAlertRulesModal() {
  openXMonitorOnPulse('left');
}

/** @deprecated Modal removed — redirects to Pulse rail. */
export function AlertRulesModal() {
  return null;
}
