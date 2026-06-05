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

      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden px-3 py-3 sm:px-4">
        {children}
      </div>
    </div>
  );
}
