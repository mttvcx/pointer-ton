'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

const TABS: { key: string; href: string; label: string; count?: number }[] = [
  { key: 'discover', href: '/squads/discover-traders', label: 'Discover' },
  { key: 'recruit', href: '/squads/recruit', label: 'Recruit' },
  { key: 'looking', href: '/squads/looking', label: 'Looking' },
  { key: 'my', href: '/squads/my', label: 'My squads' },
  /** No hardcoded invite counts — badge returns when invites are API-backed. */
  { key: 'inbox', href: '/squads/inbox', label: 'Invites' },
  { key: 'reputation', href: '/squads/reputation', label: 'Reputation' },
];

export function SquadsSubnav({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <nav
      className={cn(
        'sticky top-0 z-30 flex items-center gap-1 overflow-x-auto border-b border-border-subtle bg-bg-hover/95 px-2 backdrop-blur-sm sm:px-3',
        className,
      )}
      aria-label="Squads sections"
    >
      {TABS.map((t) => {
        let active =
          pathname === t.href || (t.href !== '/squads' && pathname?.startsWith(t.href + '/'));
        if (t.key === 'my' && pathname?.startsWith('/squads/room')) {
          active = true;
        }
        return (
          <Link
            key={t.href}
            href={t.href}
            className={cn(
              'relative whitespace-nowrap px-3 py-2.5 text-sm font-medium transition-colors',
              active ? 'text-fg-primary' : 'text-fg-muted hover:text-fg-secondary',
            )}
          >
            {t.label}
            {t.count != null ? (
              <span
                className={cn(
                  'ml-1.5 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums',
                  active ? 'bg-accent-ethos/15 text-accent-ethos' : 'bg-bg-sunken text-fg-muted',
                )}
              >
                {t.count}
              </span>
            ) : null}
            {active ? (
              <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-accent-ethos" aria-hidden />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
