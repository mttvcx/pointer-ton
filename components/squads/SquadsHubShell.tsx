'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Users } from 'lucide-react';
import EthosWordmark from '@/components/squads/EthosWordmark';
import { SquadsSubnav } from '@/components/squads/SquadsSubnav';
import { squadsSubtitleForPath } from '@/lib/squads/squadsUiCopy';

export function SquadsHubShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const subtitle = squadsSubtitleForPath(pathname);
  const hideHubChrome = pathname?.startsWith('/squads/room/');

  if (hideHubChrome) {
    return (
      <div className="flex min-h-0 flex-1 flex-col px-2 py-3 pb-[calc(var(--app-bottombar-h)+12px)] sm:px-3">
        {children}
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col px-2 py-3 pb-[calc(var(--app-bottombar-h)+12px)] sm:px-3">
      <header className="flex items-center gap-3 border-b border-border-subtle px-4 pb-3 pt-4">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent-ethos/10">
          <Users className="h-4 w-4 text-accent-ethos" strokeWidth={2} aria-hidden />
        </div>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <h1 className="text-base font-semibold tracking-tight text-fg-primary">Squads</h1>
          <p className="truncate text-xs text-fg-muted">{subtitle}</p>
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-1.5">
          <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-fg-muted">
            Powered by
          </span>
          <EthosWordmark className="text-fg-primary" height={11} />
        </div>
      </header>
      <SquadsSubnav />
      {/* shrink-0: page height grows with content so <main overflow-y-auto> scrolls */}
      <div className="min-h-0 shrink-0 pt-4">{children}</div>
    </div>
  );
}
