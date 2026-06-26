'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  Activity,
  CandlestickChart,
  Coins,
  LogOut,
  Package,
  Radar,
  Settings,
  Shield,
  Trophy,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useMobileNavStore } from '@/store/mobileNav';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useUIStore } from '@/store/ui';
import { APP_NAV } from '@/components/layout/navConfig';
import { shortenAddress } from '@/lib/utils/addresses';
import { cn } from '@/lib/utils/cn';

const NAV_ICON: Record<string, LucideIcon> = {
  '/pulse': Activity,
  '/perps': CandlestickChart,
  '/packs': Package,
  '/portfolio': Wallet,
  '/track': Radar,
  '/squads': Users,
  '/championship': Trophy,
  '/points': Coins,
};

/**
 * Mobile ☰ drawer (right slide-out) — the Axiom pattern. Holds the full route
 * list plus settings + sign-out, so the bottom bar can stay to ~5 primary tabs.
 * Open state lives in `useMobileNavStore`; rendered once at the shell level.
 */
export function MobileDrawer() {
  const open = useMobileNavStore((s) => s.drawerOpen);
  const setOpen = useMobileNavStore((s) => s.setDrawerOpen);
  const pathname = usePathname();
  const router = useRouter();
  const { authenticated, logout, linkedTonAddress } = usePointerAuth();
  const openSettings = useUIStore((s) => s.openSettings);

  const close = () => setOpen(false);

  // Close on Escape; lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, setOpen]);

  return (
    <div className="lg:hidden" aria-hidden={!open}>
      <button
        type="button"
        aria-label="Close menu"
        onClick={close}
        className={cn(
          'fixed inset-0 z-[140] bg-black/55 transition-opacity duration-200',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        tabIndex={open ? 0 : -1}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Menu"
        className={cn(
          'fixed right-0 top-0 bottom-0 z-[150] flex w-[82%] max-w-[20rem] flex-col overflow-y-auto border-l border-white/[0.08] bg-bg-base pb-[env(safe-area-inset-bottom,0px)] shadow-[0_0_60px_-10px_rgba(0,0,0,0.7)] transition-transform duration-250 ease-out',
          open ? 'translate-x-0' : 'translate-x-full',
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-4 pt-[max(env(safe-area-inset-top,0px),0.75rem)] pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#2a2a2d]">
              <img src="/branding/pointer-bird.png" alt="" width={22} height={22} className="h-5 w-auto object-contain" />
            </span>
            <div className="min-w-0">
              <p className="text-[14px] font-semibold text-fg-primary">pointer.</p>
              <p className="truncate text-[11px] text-fg-muted">
                {authenticated ? (linkedTonAddress ? shortenAddress(linkedTonAddress, 4) : 'Signed in') : 'Not signed in'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-0.5 px-2 py-3">
          <p className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Navigation</p>
          {APP_NAV.map((item) => {
            const Icon = NAV_ICON[item.href] ?? Activity;
            const active = pathname === item.href || Boolean(pathname?.startsWith(item.href + '/'));
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onClick={close}
                className={cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors',
                  active ? 'bg-accent-primary/10 text-accent-primary' : 'text-fg-secondary hover:bg-bg-hover hover:text-fg-primary',
                )}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
                <span className="flex-1">{item.label}</span>
                {item.badge ? (
                  <span className="rounded border border-border-subtle px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-fg-muted">
                    {item.badge}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        {/* Settings */}
        <div className="mt-auto flex flex-col gap-0.5 border-t border-white/[0.06] px-2 py-3">
          <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-fg-muted">Settings</p>
          <button
            type="button"
            onClick={() => {
              close();
              openSettings('general');
            }}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary"
          >
            <Settings className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            Settings
          </button>
          <Link
            href="/portfolio?tab=wallets"
            prefetch
            onClick={close}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary"
          >
            <Shield className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
            Account &amp; security
          </Link>
          {authenticated ? (
            <button
              type="button"
              onClick={() => {
                close();
                void logout();
                router.replace('/');
              }}
              className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px] font-semibold text-signal-bear transition-colors hover:bg-signal-bear/10"
            >
              <LogOut className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden />
              Sign out
            </button>
          ) : null}
        </div>
      </aside>
    </div>
  );
}
