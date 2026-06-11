'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { SquadsSubnav } from '@/components/squads/SquadsSubnav';

export function SquadsHubShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const hideHubChrome = pathname?.startsWith('/squads/room/');

  if (hideHubChrome) {
    return <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header className="flex shrink-0 items-center gap-3 border-b border-border-subtle px-3 py-2 sm:px-4">
        <h1 className="text-[15px] font-semibold tracking-tight text-fg-primary">Squads</h1>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">Powered by</span>
          {/* eslint-disable-next-line @next/next/no-img-element -- static raster brand asset */}
          <img
            src="/branding/ethos-wordmark.png"
            alt="Ethos"
            className="block h-5 w-auto object-contain opacity-90"
            draggable={false}
          />
        </div>
      </header>

      <SquadsSubnav />

      {/* Squads backend lands in a later drop — never present sample rooms as live. */}
      <div className="flex shrink-0 items-center gap-2 border-b border-amber-300/[0.13] bg-amber-300/[0.04] px-3 py-1.5 sm:px-4">
        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/70" aria-hidden />
        <p className="text-[10.5px] font-medium leading-none text-amber-100/75">
          <span className="font-semibold text-amber-100/90">Preview</span> · Squads is in
          early access — discovery and rooms show sample data until squad backend ships.
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4">
        {children}
      </div>
    </div>
  );
}
