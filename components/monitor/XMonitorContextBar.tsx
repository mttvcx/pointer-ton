'use client';

import { useEffect } from 'react';
import {
  Bell,
  Hash,
  History,
  ListChecks,
  Monitor,
  Rss,
  SlidersHorizontal,
  TrendingDown,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { fireCaMentionToast, fireTradeToast } from '@/components/monitor/previewToasts';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';
import { useTokenDockPeekStore } from '@/store/tokenDockPeek';
import { useXMonitorPageStore, type XMonitorPage } from '@/store/xMonitorPage';
import { XMonitorSellFeed } from '@/components/monitor/XMonitorSellFeed';
import { XMonitorTokenHistory } from '@/components/monitor/XMonitorTokenHistory';
import { XMonitorRules } from '@/components/monitor/XMonitorRules';
import { XMonitorSettings } from '@/components/monitor/XMonitorSettings';

type PageDef = { id: Exclude<XMonitorPage, null>; label: string; icon: typeof Rss; title: string };

const PAGES: PageDef[] = [
  { id: 'sell', label: 'Sells', icon: TrendingDown, title: 'Sell feed' },
  { id: 'history', label: 'History', icon: History, title: 'Token history' },
  { id: 'rules', label: 'Rules', icon: ListChecks, title: 'Automation rules' },
  { id: 'settings', label: 'Settings', icon: SlidersHorizontal, title: 'X monitor settings' },
];

export function XMonitorContextBar() {
  const railOpen = usePulseTwitterRailStore((s) => s.side !== 'hidden');
  const peekOpen = useTokenDockPeekStore((s) => s.xMonitorPeekOpen);
  const open = railOpen || peekOpen;

  const page = useXMonitorPageStore((s) => s.page);
  const setPage = useXMonitorPageStore((s) => s.setPage);
  const toggle = useXMonitorPageStore((s) => s.toggle);
  const close = useXMonitorPageStore((s) => s.close);

  // Fold the page popup away whenever the monitor itself is dismissed.
  useEffect(() => {
    if (!open && page) close();
  }, [open, page, close]);

  // Esc closes the active page.
  useEffect(() => {
    if (!page) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [page, close]);

  if (!open) return null;

  const active = PAGES.find((p) => p.id === page) ?? null;

  return (
    <div className="pointer-events-none fixed inset-x-0 z-[96] flex justify-center" style={{ bottom: 'calc(var(--app-bottombar-h) + 8px)' }}>
      <div className="pointer-events-auto flex w-full max-w-[520px] flex-col items-center px-3">
        {/* Popup page — rises above the strip */}
        {active ? (
          <div className="mb-2 flex w-full flex-col overflow-hidden rounded-xl border border-white/[0.12] bg-bg-raised shadow-[0_24px_60px_-18px_rgba(0,0,0,0.85)]">
            <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] bg-bg-hover px-3 py-2">
              <div className="flex items-center gap-2">
                <active.icon className="h-3.5 w-3.5 text-accent-primary" strokeWidth={2} aria-hidden />
                <h3 className="text-[12px] font-semibold uppercase tracking-wide text-fg-primary">{active.title}</h3>
              </div>
              <button
                type="button"
                onClick={close}
                aria-label="Close page"
                className="btn-press group/close flex h-6 w-6 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-signal-bear/15 hover:text-signal-bear"
              >
                <X className="h-3.5 w-3.5 transition-transform group-hover/close:rotate-90" strokeWidth={2.25} aria-hidden />
              </button>
            </header>
            <div className="flex min-h-0 flex-col overflow-hidden" style={{ height: 'min(58vh, 500px)' }}>
              {page === 'sell' || page === 'history' ? (
                <div className="min-h-0 flex-1 overflow-y-auto [scrollbar-color:rgba(255,255,255,0.14)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-track]:bg-transparent">
                  {page === 'sell' ? <XMonitorSellFeed /> : <XMonitorTokenHistory />}
                </div>
              ) : page === 'rules' ? (
                <XMonitorRules />
              ) : (
                <XMonitorSettings />
              )}
            </div>
          </div>
        ) : null}

        {/* The strip: monitor avatar + encircled inline page buttons */}
        <div className="flex items-center gap-1.5 rounded-full border border-white/[0.12] bg-bg-raised/95 p-1 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.8)] backdrop-blur">
          <span
            className="flex h-7 items-center gap-1.5 rounded-full bg-accent-primary/[0.14] px-2.5 text-accent-primary"
            title="X monitor"
          >
            <Monitor className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            <span className="text-[10.5px] font-bold uppercase tracking-wide">Monitor</span>
          </span>
          <span className="h-4 w-px bg-white/[0.1]" aria-hidden />
          <button
            type="button"
            onClick={() => setPage(null)}
            className={cn(
              'btn-press flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition-colors',
              page === null
                ? 'bg-accent-primary/20 text-accent-primary'
                : 'text-fg-muted hover:bg-white/[0.06] hover:text-fg-secondary',
            )}
            title="Live feed"
          >
            <Rss className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Feed
          </button>
          {PAGES.map((p) => {
            const on = page === p.id;
            const Icon = p.icon;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => toggle(p.id)}
                className={cn(
                  'btn-press flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold transition-colors',
                  on
                    ? 'bg-accent-primary/20 text-accent-primary'
                    : 'text-fg-muted hover:bg-white/[0.06] hover:text-fg-secondary',
                )}
                title={p.title}
              >
                <Icon className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                {p.label}
              </button>
            );
          })}
          <span className="h-4 w-px bg-white/[0.1]" aria-hidden />
          <button
            type="button"
            onClick={fireCaMentionToast}
            title="Preview a Discord CA-mention toast"
            className="btn-press flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold text-fg-muted transition-colors hover:bg-[#5865F2]/15 hover:text-[#8b95ff]"
          >
            <Hash className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            CA toast
          </button>
          <button
            type="button"
            onClick={fireTradeToast}
            title="Preview a tracked-wallet trade toast"
            className="btn-press flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[11px] font-semibold text-fg-muted transition-colors hover:bg-signal-bull/15 hover:text-signal-bull"
          >
            <Bell className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
            Trade toast
          </button>
        </div>
      </div>
    </div>
  );
}
