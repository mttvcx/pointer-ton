'use client';

import { PanelLeft } from 'lucide-react';
import { openXMonitorOnPulse } from '@/lib/xMonitor/openXMonitorOnPulse';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';
import { useTokenDockPeekStore } from '@/store/tokenDockPeek';

/** Compact co-pilot entry — opens the Pulse side-rail X monitor. */
export function XMonitorCopilotCard() {
  const railSide = usePulseTwitterRailStore((s) => s.side);
  const walletOpen = useTokenDockPeekStore((s) => s.walletPeekOpen);

  if (railSide !== 'hidden') {
    return (
      <div className="rounded-sm border border-white/[0.08] bg-bg-raised px-3 py-2.5">
        <p className="text-[11px] text-fg-secondary">X monitor is open on Pulse.</p>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-white/[0.08] bg-bg-raised px-3 py-2.5">
      <p className="text-[11px] leading-snug text-fg-secondary">
        Tweet feed, AI deploy, and @ listen rules — one panel on Pulse.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => openXMonitorOnPulse('left')}
          className="btn-press inline-flex items-center gap-1.5 rounded-sm border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-primary hover:bg-white/[0.08]"
        >
          <PanelLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Open on Pulse
        </button>
        <button
          type="button"
          onClick={() => useTokenDockPeekStore.getState().setWalletPeekOpen(true)}
          className="btn-press rounded-sm border border-white/[0.08] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-muted hover:text-fg-primary"
        >
          {walletOpen ? 'Tracker open' : 'Open tracker'}
        </button>
      </div>
    </div>
  );
}
