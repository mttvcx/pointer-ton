'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, RefreshCw, Server } from 'lucide-react';
import {
  BOTTOM_BAR_REGIONS,
  bottomBarRegionById,
  latencyTone,
  type BottomBarRegionId,
} from '@/lib/layout/bottomBarRegions';
import { useOverlayPresence, POPOVER_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { popoverPanelClasses } from '@/lib/ui/overlayMotion';
import { cn } from '@/lib/utils/cn';
import { useShellPrefsStore } from '@/store/shellPrefs';

function latencyClass(ms: number): string {
  const tone = latencyTone(ms);
  if (tone === 'good') return 'text-signal-bull';
  if (tone === 'mid') return 'text-signal-warn';
  return 'text-signal-bear';
}

export function BottomBarRegionMenu() {
  const regionId = useShellPrefsStore((s) => s.regionId);
  const setRegionId = useShellPrefsStore((s) => s.setRegionId);
  const active = bottomBarRegionById(regionId);
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const { mounted, visible } = useOverlayPresence(open, POPOVER_ANIM_CLOSE_MS);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current?.contains(e.target as Node)) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        className="inline-flex h-full items-center gap-0.5 rounded-md px-1 text-[11px] font-medium leading-none text-fg-secondary transition hover:bg-white/[0.06] hover:text-fg-primary"
      >
        {active.label}
        <ChevronDown
          className={cn('h-3 w-3 text-fg-muted transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>

      {mounted ? (
        <div
          role="listbox"
          aria-label="Select region"
          className={cn(
            'absolute bottom-[calc(100%+8px)] right-0 z-[200] w-[13.5rem] overflow-hidden rounded-lg border border-white/[0.08] bg-bg-raised py-1 shadow-[0_16px_40px_-12px_rgba(0,0,0,0.85)]',
            popoverPanelClasses(visible),
          )}
        >
          <div className="flex items-center justify-between border-b border-white/[0.06] px-3 py-2">
            <span className="text-[11px] font-semibold text-fg-primary">Regions</span>
            <button
              type="button"
              className="rounded p-1 text-fg-muted hover:bg-white/[0.06] hover:text-fg-secondary"
              title="Refresh latency"
              onClick={() => setOpen(false)}
            >
              <RefreshCw className="h-3.5 w-3.5" />
            </button>
          </div>
          {BOTTOM_BAR_REGIONS.map((r) => {
            const on = r.id === regionId;
            return (
              <button
                key={r.id}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => {
                  setRegionId(r.id as BottomBarRegionId);
                  setOpen(false);
                }}
                className={cn(
                  'relative flex w-full items-center gap-2 px-3 py-2 text-left text-[12px] transition-colors',
                  on
                    ? 'bg-white/[0.07] text-fg-primary before:absolute before:left-0 before:top-1 before:bottom-1 before:w-[2px] before:rounded-full before:bg-signal-bull'
                    : 'text-fg-secondary hover:bg-white/[0.05] hover:text-fg-primary',
                )}
              >
                <Server className="h-3.5 w-3.5 shrink-0 text-fg-muted" aria-hidden />
                <span className="min-w-0 flex-1 font-medium">{r.label}</span>
                <span className={cn('shrink-0 tabular-nums text-[11px]', latencyClass(r.latencyMs))}>
                  {r.latencyMs}ms
                </span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
