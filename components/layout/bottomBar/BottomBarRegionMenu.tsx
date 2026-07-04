'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
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

const MENU_W_PX = 216;

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
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { mounted, visible } = useOverlayPresence(open, POPOVER_ANIM_CLOSE_MS);
  const [menuPos, setMenuPos] = useState<{ left: number; bottom: number } | null>(null);

  const updateMenuPos = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const left = Math.min(
      Math.max(8, rect.right - MENU_W_PX),
      window.innerWidth - MENU_W_PX - 8,
    );
    const bottom = window.innerHeight - rect.top + 8;
    setMenuPos({ left, bottom });
  }, []);

  useEffect(() => {
    if (!open) return;
    updateMenuPos();
    window.addEventListener('resize', updateMenuPos);
    window.addEventListener('scroll', updateMenuPos, true);
    return () => {
      window.removeEventListener('resize', updateMenuPos);
      window.removeEventListener('scroll', updateMenuPos, true);
    };
  }, [open, updateMenuPos]);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (t instanceof Element && t.closest('[data-bottom-bar-region-menu]')) return;
      setOpen(false);
    }
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const menu =
    mounted && menuPos
      ? createPortal(
          <div
            data-bottom-bar-region-menu
            role="listbox"
            aria-label="Select region"
            className={cn(
              'fixed z-[270] overflow-hidden rounded-md border border-border-subtle bg-bg-raised py-1 shadow-2xl backdrop-blur-md',
              popoverPanelClasses(visible),
            )}
            style={{
              left: menuPos.left,
              bottom: menuPos.bottom,
              width: MENU_W_PX,
            }}
          >
            <div className="flex items-center justify-between border-b border-border-subtle bg-bg-sunken/40 px-3 py-2">
              <span className="text-[11px] font-semibold text-fg-primary">Regions</span>
              <button
                type="button"
                className="rounded-sm p-1 text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-secondary"
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
                      ? 'bg-bg-hover text-fg-primary before:absolute before:bottom-1 before:left-0 before:top-1 before:w-[2px] before:rounded-full before:bg-accent-primary'
                      : 'text-fg-secondary hover:bg-bg-hover/80 hover:text-fg-primary',
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
          </div>,
          document.body,
        )
      : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((v) => {
            const next = !v;
            if (next) queueMicrotask(updateMenuPos);
            return next;
          });
        }}
        aria-expanded={open}
        aria-haspopup="listbox"
        className={cn(
          'inline-flex h-7 items-center gap-0.5 rounded-md border border-transparent px-1.5 text-[11px] font-medium leading-none text-fg-secondary transition-colors',
          'hover:border-border-subtle hover:bg-bg-hover hover:text-fg-primary',
          open && 'border-border-subtle bg-bg-hover text-fg-primary',
        )}
      >
        {active.label}
        <ChevronDown
          className={cn('h-3 w-3 text-fg-muted transition-transform', open && 'rotate-180')}
          aria-hidden
        />
      </button>
      {menu}
    </>
  );
}
