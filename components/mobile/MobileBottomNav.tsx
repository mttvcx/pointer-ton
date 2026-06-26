'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, CandlestickChart, Menu, Radar, Wallet } from 'lucide-react';
import { useMobileNavStore } from '@/store/mobileNav';
import { cn } from '@/lib/utils/cn';

/**
 * Mobile bottom tab bar (Axiom-style). Primary routes only — everything else
 * lives behind "More" (the ☰ drawer). Hidden from `lg` up where the desktop
 * dock BottomBar takes over.
 */
const TABS = [
  { label: 'Pulse', href: '/pulse', icon: Activity },
  { label: 'Perps', href: '/perps', icon: CandlestickChart },
  { label: 'Track', href: '/track', icon: Radar },
  { label: 'Portfolio', href: '/portfolio', icon: Wallet },
] as const;

export function MobileBottomNav() {
  const pathname = usePathname();
  const setDrawerOpen = useMobileNavStore((s) => s.setDrawerOpen);

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-[100] flex h-14 items-stretch border-t border-white/[0.08] bg-bg-base pb-[env(safe-area-inset-bottom,0px)] lg:hidden"
      aria-label="Primary"
    >
      {TABS.map(({ label, href, icon: Icon }) => {
        const active = pathname === href || Boolean(pathname?.startsWith(href + '/'));
        return (
          <Link
            key={href}
            href={href}
            prefetch
            className={cn(
              'flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
              active ? 'text-accent-primary' : 'text-fg-muted hover:text-fg-secondary',
            )}
          >
            <Icon className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />
            {label}
          </Link>
        );
      })}
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className="flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium text-fg-muted transition-colors hover:text-fg-secondary"
        aria-label="More"
      >
        <Menu className="h-[22px] w-[22px]" strokeWidth={2} aria-hidden />
        More
      </button>
    </nav>
  );
}
