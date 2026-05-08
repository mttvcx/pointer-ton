'use client';

import { PanelRight, X } from 'lucide-react';
import { AlertRulesSection } from '@/components/alerts/AlertRulesSection';
import { useUIStore } from '@/store/ui';

export function AlertRulesDockPanel() {
  const docked = useUIStore((s) => s.alertRulesDocked);
  const width = useUIStore((s) => s.alertRulesDockWidth);
  const setDocked = useUIStore((s) => s.setAlertRulesDocked);
  const setPopout = useUIStore((s) => s.setAlertRulesPopout);

  if (!docked) return null;

  return (
    <aside
      aria-label="Alert builder docked"
      className="relative flex h-full min-h-0 shrink-0 flex-col border-r border-[#1b1f2a] bg-[#080d14]/96 backdrop-blur-md"
      style={{ width, minWidth: width, maxWidth: width }}
    >
      <div
        className="flex shrink-0 items-center justify-between gap-2 border-b border-[#1b1f2a] px-2 py-2"
        style={{ backgroundColor: '#11141b' }}
      >
        <div className="min-w-0">
          <div className="truncate text-[12px] font-semibold text-fg-primary">Alert builder</div>
          <div className="text-[10px] text-fg-muted">Docked · same rail pattern as co-pilot</div>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <button
            type="button"
            className="focus-ring rounded-md p-1.5 text-fg-muted hover:bg-white/5 hover:text-white"
            title="Detach to floating window"
            onClick={() => {
              setDocked(false);
              const header = document.querySelector('header');
              const top = Math.round((header?.getBoundingClientRect().bottom ?? 72) + 8);
              const w = Math.min(440, Math.max(300, Math.round(window.innerWidth * 0.36)));
              const h = Math.min(600, Math.max(320, window.innerHeight - top - 72));
              setPopout({ top, left: 16, width: w, height: h });
            }}
          >
            <PanelRight className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
          <button
            type="button"
            className="focus-ring rounded-md p-1.5 text-fg-muted hover:bg-white/5 hover:text-white"
            title="Close dock"
            onClick={() => setDocked(false)}
          >
            <X className="h-3.5 w-3.5" strokeWidth={2.25} />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
        <AlertRulesSection embedInFloatingPanel />
      </div>
    </aside>
  );
}
