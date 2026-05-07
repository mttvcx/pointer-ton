'use client';

import { UI_DEMO_STORAGE_KEY, uiDemoModeFromEnv } from '@/lib/dev/uiDemoMode';
import { setUiDemoLocalStorage, useUiDemoMode } from '@/lib/hooks/useUiDemoMode';

export function UiDemoModeBanner() {
  const on = useUiDemoMode();
  if (!on) return null;

  const envLocked = uiDemoModeFromEnv();

  return (
    <div className="shrink-0 border-b border-amber-500/35 bg-amber-500/[0.08] px-3 py-1.5 text-center text-[10px] leading-snug text-amber-100/95">
      <span className="font-semibold">UI demo mode</span>
      {': demo data fills empty token tabs, Pulse feeds, portfolio tables, share cards, and search history only; same UI code as live. '}
      {envLocked ? (
        <span className="text-amber-200/80">Unset NEXT_PUBLIC_UI_DEMO_MODE to turn off from env.</span>
      ) : null}
      {process.env.NODE_ENV === 'development' ? (
        <span className="ml-2 inline-flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            className="rounded border border-amber-500/40 px-1.5 py-0.5 font-medium text-amber-200 hover:bg-amber-500/15"
            onClick={() => {
              setUiDemoLocalStorage(true);
              window.location.reload();
            }}
          >
            Save demo flag + reload
          </button>
          <button
            type="button"
            className="rounded border border-amber-500/40 px-1.5 py-0.5 font-medium text-amber-200 hover:bg-amber-500/15"
            onClick={() => {
              setUiDemoLocalStorage(false);
              window.location.reload();
            }}
          >
            Clear demo flag + reload
          </button>
          <span className="tabular-nums text-[9px] text-amber-200/60">{UI_DEMO_STORAGE_KEY}=1</span>
        </span>
      ) : null}
    </div>
  );
}
