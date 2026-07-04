'use client';

import { useEffect } from 'react';
import { cn } from '@/lib/utils/cn';
import { CloseButton } from '@/components/ui/CloseButton';
import { usePulseTwitterRailStore } from '@/store/pulseTwitterRail';
import { useTokenDockPeekStore } from '@/store/tokenDockPeek';
import { useXMonitorPageStore } from '@/store/xMonitorPage';
import { XMONITOR_PAGES } from '@/components/monitor/xMonitorPages';
import { XMonitorSellFeed } from '@/components/monitor/XMonitorSellFeed';
import { XMonitorTokenHistory } from '@/components/monitor/XMonitorTokenHistory';
import { XMonitorRules } from '@/components/monitor/XMonitorRules';
import { XMonitorSettings } from '@/components/monitor/XMonitorSettings';

/**
 * Popup host for the X Monitor sub-pages. The triggers now live inline in the
 * bottom bar (XMonitorSubNav); this renders the selected page above the bar,
 * with a click-away backdrop. Nothing shows until a page is picked.
 */
export function XMonitorContextBar() {
  const railOpen = usePulseTwitterRailStore((s) => s.side !== 'hidden');
  const peekOpen = useTokenDockPeekStore((s) => s.xMonitorPeekOpen);
  const open = railOpen || peekOpen;

  const page = useXMonitorPageStore((s) => s.page);
  const close = useXMonitorPageStore((s) => s.close);

  // Fold the page away whenever the monitor itself is dismissed.
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

  const active = XMONITOR_PAGES.find((p) => p.id === page) ?? null;
  if (!open || !active) return null;

  // Config surfaces (Settings / Rules) become a focal, centered modal that darkens
  // everything behind. The live feeds (Sells / History) stay a light bottom popup.
  const isModal = page === 'settings' || page === 'rules';

  return (
    <>
      {/* Click-away catcher — dark + blurred for the modal surfaces */}
      <button
        type="button"
        aria-label="Close page"
        onClick={close}
        className={cn(
          'pointer-events-auto fixed inset-0 z-[96] cursor-default animate-in fade-in-0 duration-150',
          isModal ? 'bg-black/65 backdrop-blur-[2px]' : 'bg-black/25',
        )}
      />
      <div
        className={cn(
          'pointer-events-none fixed z-[97] flex px-3',
          isModal ? 'inset-0 items-center justify-center' : 'inset-x-0 justify-center',
        )}
        style={isModal ? undefined : { bottom: 'calc(var(--app-bottombar-h) + 8px)' }}
      >
        <div
          className={cn(
            'pointer-events-auto flex w-full flex-col overflow-hidden rounded-xl border border-white/[0.12] bg-bg-raised shadow-[0_24px_60px_-18px_rgba(0,0,0,0.85)] animate-in fade-in-0 duration-200',
            isModal ? 'max-w-[620px] zoom-in-95' : 'max-w-[520px] slide-in-from-bottom-2',
          )}
        >
          <header className="flex shrink-0 items-center justify-between gap-2 border-b border-white/[0.08] bg-bg-hover px-3 py-2">
            <div className="flex items-center gap-2">
              <active.icon className="h-3.5 w-3.5 text-accent-primary" strokeWidth={2} aria-hidden />
              <h3 className="text-[12px] font-semibold uppercase tracking-wide text-fg-primary">{active.title}</h3>
            </div>
            <CloseButton size="sm" label="Close page" onClick={close} />
          </header>
          <div className="flex min-h-0 flex-col overflow-hidden" style={{ height: isModal ? 'min(80vh, 660px)' : 'min(58vh, 500px)' }}>
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
      </div>
    </>
  );
}
