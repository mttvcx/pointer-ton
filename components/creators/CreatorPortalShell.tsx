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
    <div className="creator-canvas flex min-h-dvh text-fg-primary">
      {/* Mobile scrim */}
      {mobileOpen ? (
        <button
          type="button"
          aria-label="Close menu"
          onClick={() => setMobileOpen(false)}
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm lg:hidden"
        />
      ) : null}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex w-60 flex-col transition-transform duration-300 lg:static lg:translate-x-0 lg:py-4 lg:pl-4',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="creator-glass flex h-full flex-col rounded-none lg:rounded-2xl">
          <div className="flex h-16 items-center gap-2.5 px-5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/branding/pointer-bird.png" alt="" className="h-6 w-6" />
            <Link
              href="/portal/dashboard"
              className="creator-gradient-text text-[15px] font-semibold tracking-tight"
            >
              Pointer Creators
            </Link>
          </div>

          <nav className="flex-1 space-y-1 px-2.5">
            {NAV.map(({ href, label, icon: Icon }) => {
              const on = pathname === href || pathname.startsWith(`${href}/`);
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={() => setMobileOpen(false)}
                  data-active={on}
                  className={cn(
                    'creator-nav-item flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium',
                    on ? 'text-fg-primary' : 'text-fg-secondary hover:bg-white/[0.04] hover:text-fg-primary',
                  )}
                >
                  <Icon
                    className={cn('h-[17px] w-[17px] shrink-0', on ? 'text-accent-glow' : '')}
                    strokeWidth={2}
                  />
                  {label}
                </Link>
              );
            })}
            {isAdmin ? (
              <Link
                href="/portal/admin"
                onClick={() => setMobileOpen(false)}
                data-active={pathname.startsWith('/portal/admin')}
                className={cn(
                  'creator-nav-item flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-medium',
                  pathname.startsWith('/portal/admin')
                    ? 'text-signal-warn'
                    : 'text-fg-secondary hover:bg-white/[0.04] hover:text-fg-primary',
                )}
              >
                <Shield className="h-[17px] w-[17px] shrink-0" strokeWidth={2} />
                Admin review
              </Link>
            ) : null}
          </nav>

          <div className="m-2.5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-2.5">
            <div className="flex items-center gap-2.5 px-1">
              {avatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatar} alt="" className="h-8 w-8 rounded-full ring-1 ring-white/10" />
              ) : (
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-accent-primary/20 text-xs font-bold text-accent-glow ring-1 ring-accent-primary/25">
                  {username.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold">{username}</span>
            </div>
            <button
              type="button"
              onClick={() => void signOut()}
              className="mt-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] text-fg-muted transition-colors hover:bg-white/[0.05] hover:text-fg-primary"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </div>
        </div>
      </aside>

      <div className="relative z-10 flex min-w-0 flex-1 flex-col">
        <header className="creator-glass sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Menu"
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-white/10 bg-white/[0.03]"
          >
            <Menu className="h-4.5 w-4.5" />
          </button>
          <span className="creator-gradient-text text-sm font-semibold">Pointer Creators</span>
        </header>
        <main className="relative z-10 min-h-0 flex-1 overflow-auto p-4 sm:p-6 lg:p-8">{children}</main>
      </div>
    </div>
  );
}
