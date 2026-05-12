'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { Users } from 'lucide-react';
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
    <div className="flex min-h-0 flex-1 flex-col gap-4 px-2 py-3 pb-[calc(var(--app-bottombar-h)+12px)] sm:px-3">
      <header className="border-b border-border-subtle pb-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-bg-elevated/50">
            <Users className="h-5 w-5 text-signal-info" strokeWidth={2} aria-hidden />
          </div>
          <div className="min-w-0">
            <h1 className="text-[19px] font-semibold tracking-tight text-fg-primary">Squads</h1>
            <p className="mt-1 max-w-[72ch] text-[12px] leading-relaxed text-fg-secondary">
              {subtitle}
            </p>
          </div>
        </div>
        <div className="mt-4">
          <SquadsSubnav />
        </div>
      </header>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
