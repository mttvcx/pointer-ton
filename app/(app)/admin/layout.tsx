'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAdminMe, adminCan } from '@/lib/admin/useAdminApi';
import { cn } from '@/lib/utils/cn';

type NavItem = { href: string; label: string; perm: string };

const NAV: NavItem[] = [
  { href: '/admin', label: 'Overview', perm: '*any*' },
  { href: '/admin/ops', label: 'System health', perm: '*any*' },
  { href: '/admin/metrics', label: 'Metrics', perm: '*any*' },
  { href: '/admin/emergency', label: 'Emergency', perm: 'emergency.control' },
  { href: '/admin/ai-spend', label: 'AI spend', perm: '*any*' },
  { href: '/admin/providers', label: 'Providers', perm: '*any*' },
  { href: '/admin/extension', label: 'Extension', perm: '*any*' },
  { href: '/admin/users', label: 'Users', perm: 'users.read' },
  { href: '/admin/packs', label: 'Packs', perm: 'packs.read' },
  { href: '/admin/economy', label: 'Economy', perm: 'referrals.read' },
  { href: '/admin/campaigns', label: 'Campaigns', perm: 'campaigns.read' },
  { href: '/admin/flags', label: 'Feature flags', perm: 'flags.read' },
  { href: '/admin/bug-reports', label: 'Bug reports', perm: 'bugreports.read' },
  { href: '/admin/identity', label: 'Identity', perm: 'identity.read' },
  { href: '/admin/championship', label: 'Championship', perm: 'championship.read' },
  { href: '/admin/audit', label: 'Audit log', perm: 'audit.read' },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const meQ = useAdminMe();

  if (meQ.isLoading) {
    return (
      <main className="flex min-h-[60vh] items-center justify-center text-sm text-fg-muted">
        Checking admin access…
      </main>
    );
  }

  const me = meQ.data;
  if (!me) {
    return (
      <main className="flex min-h-[60vh] flex-col items-center justify-center gap-2 text-center">
        <h1 className="text-lg font-semibold text-fg-primary">Control room</h1>
        <p className="max-w-sm text-sm text-fg-muted">
          You do not have admin access. If this is unexpected, ask a super admin to grant
          you a role.
        </p>
      </main>
    );
  }

  const visible = NAV.filter((n) => n.perm === '*any*' || adminCan(me, n.perm));

  return (
    // The app shell's <main> is overflow-hidden (trading pages self-scroll), so
    // admin owns its own vertical scroll container — otherwise long pages clip.
    <div className="min-h-0 flex-1 overflow-y-auto">
    <div className="mx-auto flex w-full max-w-6xl gap-6 p-4 md:p-6">
      <aside className="hidden w-52 shrink-0 md:block">
        <div className="sticky top-4 space-y-4">
          <div>
            <h2 className="text-xs font-semibold uppercase tracking-wide text-fg-muted">
              Control room
            </h2>
            <p className="mt-1 truncate text-[11px] text-fg-muted" title={me.email ?? me.username ?? me.walletAddress ?? me.userId}>
              {me.roles.map((r) => r.name).join(', ') || 'Admin'}
            </p>
          </div>
          <nav className="flex flex-col gap-0.5">
            {visible.map((n) => {
              const active = pathname === n.href || (n.href !== '/admin' && pathname.startsWith(n.href));
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={cn(
                    'rounded-md px-2.5 py-1.5 text-[13px] transition-colors',
                    active
                      ? 'bg-bg-hover font-semibold text-fg-primary'
                      : 'text-fg-secondary hover:bg-bg-hover/60 hover:text-fg-primary',
                  )}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </aside>
      <main className="min-w-0 flex-1 pb-10">{children}</main>
    </div>
    </div>
  );
}
