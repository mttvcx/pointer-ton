'use client';

import { detachXMonitorToFloat, openXMonitorOnPulse } from '@/lib/xMonitor/openXMonitorOnPulse';

export function openXMonitorFloat(anchor?: DOMRect | null) {
  detachXMonitorToFloat(anchor);
}

export function embedXMonitorOnPulse(side: 'left' | 'right') {
  openXMonitorOnPulse(side);
}
