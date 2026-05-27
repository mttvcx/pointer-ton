'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ChevronDown } from 'lucide-react';
import { DemoSimulatedBanner } from '@/components/shared/DemoSimulatedBanner';
import { SquadsSubnav } from '@/components/squads/SquadsSubnav';
import { squadsSubtitleForPath } from '@/lib/squads/squadsUiCopy';
import { cn } from '@/lib/utils/cn';

export function SquadsHubShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const subtitle = squadsSubtitleForPath(pathname);
  const hideHubChrome = pathname?.startsWith('/squads/room/');

  if (hideHubChrome) {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-2 py-3 pb-[calc(var(--app-bottombar-h)+12px)] sm:px-3">
        <DemoSimulatedBanner
          title="Simulated · not live trading"
          detail="Squads rooms use sample data for private beta. Do not treat balances or fills as real."
        />
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-2 py-3 pb-[calc(var(--app-bottombar-h)+12px)] sm:px-3">
      <div
        className={cn(
          'flex min-h-0 w-full flex-1 flex-col rounded-xl border border-border-subtle',
          'bg-bg-hover shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]',
        )}
      >
        <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border-subtle bg-bg-hover px-3 py-2 sm:px-4">
          <h1 className="text-[15px] font-semibold tracking-tight text-fg-primary">Squads</h1>

          <details className="group/meta relative ml-auto min-w-[10rem] text-right">
            <summary
              className={cn(
                'inline-flex cursor-pointer list-none items-center gap-1 text-[11px] font-medium text-fg-muted outline-none hover:text-fg-secondary',
                '[&::-webkit-details-marker]:hidden',
              )}
            >
              About & branding
              <ChevronDown
                className="h-3.5 w-3.5 shrink-0 transition-transform group-open/meta:rotate-180"
                strokeWidth={2}
                aria-hidden
              />
            </summary>
            <div className="absolute right-0 z-40 mt-2 w-[min(22rem,calc(100vw-3rem))] rounded-lg border border-border-subtle bg-bg-raised p-3 text-left shadow-lg">
              <p className="text-xs leading-snug text-fg-secondary">{subtitle}</p>
              <div className="mt-3 flex items-center gap-2 border-t border-border-subtle pt-3">
                <span className="text-[10px] font-medium uppercase tracking-[0.14em] text-fg-muted">
                  Powered by
                </span>
                {/* eslint-disable-next-line @next/next/no-img-element -- static raster brand asset */}
                <img
                  src="/branding/ethos-wordmark.png"
                  alt="Ethos"
                  className="block h-6 w-auto object-contain opacity-90"
                  draggable={false}
                />
              </div>
            </div>
          </details>
        </header>

        <SquadsSubnav className="bg-bg-base/90 backdrop-blur-sm" />

        <DemoSimulatedBanner
          title="Simulated · not live trading"
          detail="Squads rooms, missions, and leaderboard use sample data for private beta. Do not treat balances or fills as real."
        />

        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden bg-bg-base/40 px-2 py-3 sm:px-3">
          {children}
        </div>
      </div>
    </div>
  );
}
