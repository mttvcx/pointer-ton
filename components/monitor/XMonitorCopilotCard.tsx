'use client';

import { PanelLeft } from 'lucide-react';
import { useUIStore } from '@/store/ui';
import { useTokenDockPeekStore } from '@/store/tokenDockPeek';

/** Compact co-pilot entry — opens the unified X monitor (same surface as tracker Monitor tab). */
export function XMonitorCopilotCard() {
  const docked = useUIStore((s) => s.alertRulesDocked);
  const walletOpen = useTokenDockPeekStore((s) => s.walletPeekOpen);

  if (docked) {
    return (
      <div className="rounded-sm border border-white/[0.08] bg-bg-raised px-3 py-2.5">
        <p className="text-[11px] text-fg-secondary">X monitor is docked on the left.</p>
      </div>
    );
  }

  return (
    <div className="rounded-sm border border-white/[0.08] bg-bg-raised px-3 py-2.5">
      <p className="text-[11px] leading-snug text-fg-secondary">
        Tweet feed, AI deploy, and @ listen rules — one panel.
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => useUIStore.getState().setAlertRulesDocked(true)}
          className="btn-press inline-flex items-center gap-1.5 rounded-sm border border-white/[0.1] bg-white/[0.04] px-2.5 py-1.5 text-[10px] font-semibold uppercase tracking-wide text-fg-primary hover:bg-white/[0.08]"
        >
          <PanelLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Dock monitor
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
