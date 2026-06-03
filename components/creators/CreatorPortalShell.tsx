'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  LayoutDashboard,
  PlusCircle,
  Video,
  Trophy,
  Tag,
  Settings,
  Shield,
  LogOut,
  Menu,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { useState } from 'react';

const NAV = [
  { href: '/portal/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/portal/submit', label: 'Submit Video', icon: PlusCircle },
  { href: '/portal/videos', label: 'My Videos', icon: Video },
  { href: '/portal/leaderboard', label: 'Leaderboard', icon: Trophy },
  { href: '/portal/offers', label: 'Offers', icon: Tag },
  { href: '/portal/settings', label: 'Settings', icon: Settings },
] as const;

export function CreatorPortalShell({
  children,
  username,
  avatar,
  isAdmin,
}: {
  children: React.ReactNode;
  username: string;
  avatar: string | null;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);

  async function signOut() {
    await fetch('/api/creators/auth/logout', { method: 'POST' });
    router.push('/portal');
    router.refresh();
  }

  return (
    <div className="flex min-h-dvh bg-bg-base text-fg-primary">
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-56 flex-col border-r border-border-subtle bg-bg-raised transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-14 items-center border-b border-border-subtle px-4">
          <Link href="/portal/dashboard" className="text-sm font-semibold tracking-tight">
            Pointer Creators
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 p-2">
          {NAV.map(({ href, label, icon: Icon }) => {
            const on = pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setMobileOpen(false)}
                className={cn(
                  'flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
                  on
                    ? 'bg-accent-primary/15 text-accent-glow ring-1 ring-accent-primary/25'
                    : 'text-fg-secondary hover:bg-bg-hover hover:text-fg-primary',
                )}
              >
                <Icon className="h-4 w-4 shrink-0" strokeWidth={2} />
                {label}
              </Link>
            );
          })}
          {isAdmin ? (
            <Link
              href="/portal/admin"
              className={cn(
                'flex items-center gap-2 rounded-md px-3 py-2 text-[13px] font-medium transition-colors',
                pathname.startsWith('/portal/admin')
                  ? 'bg-signal-warn/15 text-signal-warn'
                  : 'text-fg-secondary hover:bg-bg-hover',
              )}
            >
              <Shield className="h-4 w-4" strokeWidth={2} />
              Admin review
            </Link>
          ) : null}
        </nav>
        <div className="border-t border-border-subtle p-3">
          <div className="flex items-center gap-2 px-1">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={avatar} alt="" className="h-8 w-8 rounded-full" />
            ) : (
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-bg-sunken text-xs font-bold">
                {username.slice(0, 1).toUpperCase()}
              </span>
            )}
            <span className="min-w-0 flex-1 truncate text-[12px] font-medium">{username}</span>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            className="mt-2 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-[12px] text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-2 border-b border-border-subtle bg-bg-raised px-4 lg:hidden">
          <button type="button" onClick={() => setMobileOpen(true)} aria-label="Menu">
            <Menu className="h-5 w-5" />
          </button>
          <span className="text-sm font-semibold">Pointer Creators</span>
        </header>
        <main className="min-h-0 flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}
