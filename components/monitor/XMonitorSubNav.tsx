'use client';

import { Bell, Hash } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { fireCaMentionToast, fireTradeToast } from '@/components/monitor/previewToasts';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';
import { useTokenDockPeekStore } from '@/store/tokenDockPeek';
import { useXMonitorPageStore } from '@/store/xMonitorPage';
import { XMONITOR_FEED, XMONITOR_PAGES } from '@/components/monitor/xMonitorPages';

/**
 * Inline X Monitor sub-nav for the bottom bar. Appears (as a small "sub-section"
 * beside the Social button) only while the X Monitor is open, pushing the rest
 * of the dock buttons right. Buttons are a touch smaller than the main dock
 * chips since they're sub-options of one thing. Selecting a page pops it up
 * (the popup itself lives in XMonitorContextBar).
 */
export function XMonitorSubNav() {
  const railOpen = usePulseTwitterRailStore((s) => s.side !== 'hidden');
  const peekOpen = useTokenDockPeekStore((s) => s.xMonitorPeekOpen);
  const open = railOpen || peekOpen;

  const page = useXMonitorPageStore((s) => s.page);
  const setPage = useXMonitorPageStore((s) => s.setPage);
  const toggle = useXMonitorPageStore((s) => s.toggle);

  if (!open) return null;

  const btn = (active: boolean) =>
    cn(
      'btn-press flex h-[22px] shrink-0 items-center gap-1 rounded-[6px] px-1.5 text-[10px] font-semibold leading-none tracking-tight transition-colors',
      active ? 'bg-accent-primary/20 text-accent-primary' : 'text-fg-muted hover:bg-white/[0.06] hover:text-fg-secondary',
    );

  const FeedIcon = XMONITOR_FEED.icon;

  return (
    <div
      className="animate-in fade-in-0 slide-in-from-left-2 duration-150 flex shrink-0 items-center gap-0.5 rounded-lg border border-accent-primary/25 bg-accent-primary/[0.06] px-0.5"
      role="group"
      aria-label="X monitor sections"
    >
      <button type="button" onClick={() => setPage(null)} className={btn(page === null)} title={XMONITOR_FEED.title}>
        <FeedIcon className="h-3 w-3" strokeWidth={2} aria-hidden />
        {XMONITOR_FEED.label}
      </button>
      {XMONITOR_PAGES.map((p) => {
        const Icon = p.icon;
        return (
          <button key={p.id} type="button" onClick={() => toggle(p.id)} className={btn(page === p.id)} title={p.title}>
            <Icon className="h-3 w-3" strokeWidth={2} aria-hidden />
            {p.label}
          </button>
        );
      })}
      <span className="mx-0.5 h-3.5 w-px bg-white/[0.12]" aria-hidden />
      <button
        type="button"
        onClick={fireCaMentionToast}
        title="Preview a Discord CA-mention toast"
        className="btn-press flex h-[22px] shrink-0 items-center gap-1 rounded-[6px] px-1.5 text-[10px] font-semibold leading-none text-fg-muted transition-colors hover:bg-[#5865F2]/15 hover:text-[#8b95ff]"
      >
        <Hash className="h-3 w-3" strokeWidth={2} aria-hidden />
        CA
      </button>
      <button
        type="button"
        onClick={fireTradeToast}
        title="Preview a tracked-wallet trade toast"
        className="btn-press flex h-[22px] shrink-0 items-center gap-1 rounded-[6px] px-1.5 text-[10px] font-semibold leading-none text-fg-muted transition-colors hover:bg-signal-bull/15 hover:text-signal-bull"
      >
        <Bell className="h-3 w-3" strokeWidth={2} aria-hidden />
        Trade
      </button>
    </div>
  );
}
