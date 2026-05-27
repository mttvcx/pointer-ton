'use client';

import { openXMonitorOnPulse } from '@/lib/xMonitor/openXMonitorOnPulse';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';

export function AlertBuilderEmbeddedPlaceholder() {
  const railOpen = usePulseTwitterRailStore((s) => s.side !== 'hidden');

  if (!railOpen) return null;

  return (
    <div className="rounded-sm border border-white/[0.08] bg-bg-raised px-3 py-2.5 text-center">
      <p className="text-[11px] leading-relaxed text-fg-secondary">
        X monitor is open on Pulse. Use the column toggle or close it from the panel header.
      </p>
      <button
        type="button"
        className="btn-press mt-2 rounded-sm border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-primary hover:bg-white/[0.08]"
        onClick={() => openXMonitorOnPulse('left')}
      >
        Go to Pulse
      </button>
    </div>
  );
}

/** @deprecated Floating popout removed — X monitor lives on Pulse side rail only. */
export function AlertRulesPopoutHost() {
  return null;
}
