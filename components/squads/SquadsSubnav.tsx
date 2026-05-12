'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils/cn';

const LINKS: { href: string; label: string; badge?: number }[] = [
  { href: '/squads/discover-traders', label: 'Discover traders' },
  { href: '/squads/recruit', label: 'Recruit' },
  { href: '/squads/looking', label: 'Looking for squad' },
  { href: '/squads/my', label: 'My squads' },
  { href: '/squads/inbox', label: 'Invites & requests', badge: 3 },
  { href: '/squads/reputation', label: 'Reputation' },
];

export function SquadsSubnav() {
  const pathname = usePathname();

  return (
    <nav className="-mx-1 flex gap-px overflow-x-auto pb-px" aria-label="Squads sections">
      {LINKS.map(({ href, label, badge }) => {
        let active =
          pathname === href || (href !== '/squads' && pathname?.startsWith(href + '/'));
        if (href === '/squads/my' && pathname?.startsWith('/squads/room')) {
          active = true;
        }
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'relative whitespace-nowrap rounded-t-md px-3 py-2 text-[11.5px] font-semibold transition',
              active
                ? 'text-fg-primary'
                : 'text-fg-muted hover:bg-white/[0.03] hover:text-fg-secondary',
            )}
          >
            {active ? (
              <span
                className="pointer-events-none absolute inset-x-1 bottom-0 h-px bg-[#5ebffb]"
                aria-hidden
              />
            ) : null}
            <span className="relative inline-flex items-center gap-2">
              {label}
              {badge != null ? (
                <span className="rounded bg-[#1e2630] px-1.5 py-px text-[9.5px] font-bold text-fg-muted ring-1 ring-[#2a323d] tabular-nums">
                  {badge}
                </span>
              ) : null}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
