'use client';

import Link from 'next/link';
import { useAdminMe } from '@/lib/admin/useAdminApi';

const CARDS: { href: string; title: string; desc: string; perm: string }[] = [
  { href: '/admin/ops', title: 'System health', desc: 'Pointer Ops — live trading, indexer, Pulse, providers & flags.', perm: '*any*' },
  { href: '/admin/emergency', title: 'Emergency controls', desc: 'Kill switches, per-chain pause, maintenance + read-only, banner.', perm: 'emergency.control' },
  { href: '/admin/ai-spend', title: 'AI spend', desc: 'Org hourly/daily/monthly AI cost vs ceilings; top users & endpoints.', perm: '*any*' },
  { href: '/admin/providers', title: 'Provider breakers', desc: 'Helius/Moralis/InsightX/DexScreener/Jupiter usage vs budget + manual cutoff.', perm: '*any*' },
  { href: '/admin/extension', title: 'Extension readiness', desc: 'The gate to start Pointer Extension — injection/Chrome/auth/release status board.', perm: '*any*' },
  { href: '/admin/users', title: 'Users', desc: 'Search users, view profiles, linked wallets, points & referrals.', perm: 'users.read' },
  { href: '/admin/packs', title: 'Packs', desc: 'Open history and the override queue with approval gating.', perm: 'packs.read' },
  { href: '/admin/economy', title: 'Economy', desc: 'Point grants, tier assignment, referral payouts, cashback.', perm: 'referrals.read' },
  { href: '/admin/campaigns', title: 'Campaigns', desc: 'Create campaigns and issue grants.', perm: 'campaigns.read' },
  { href: '/admin/flags', title: 'Feature flags', desc: 'Toggle runtime feature flags.', perm: 'flags.read' },
  { href: '/admin/bug-reports', title: 'Bug reports', desc: 'Triage incoming diagnostics.', perm: 'bugreports.read' },
  { href: '/admin/identity', title: 'Identity', desc: 'Manage wallet identity labels.', perm: 'identity.read' },
  { href: '/admin/championship', title: 'Championship', desc: 'Review and finalize seasons.', perm: 'championship.read' },
  { href: '/admin/audit', title: 'Audit log', desc: 'Every admin action, attributed and timestamped.', perm: 'audit.read' },
];

export default function AdminHome() {
  const me = useAdminMe().data;
  const can = (p: string) => Boolean(me && (me.permissions.includes('*') || me.permissions.includes(p)));
  const cards = CARDS.filter((c) => c.perm === '*any*' || can(c.perm));

  return (
    <div className="space-y-5">
      <header>
        <h1 className="text-lg font-semibold text-fg-primary">Pointer control room</h1>
        <p className="mt-1 text-sm text-fg-muted">
          Signed in as {me?.email ?? me?.username ?? me?.walletAddress ?? me?.userId}. Roles:{' '}
          {me?.roles.map((r) => r.name).join(', ') || '—'}
        </p>
        {me?.permissions.includes('*') ? (
          <p className="mt-1 text-[12px] text-fg-secondary">
            Superadmin — Account Guardian (freeze) and Emergency rescue (server-signed sells) live under{' '}
            <Link href="/admin/users" className="text-accent-primary hover:underline">
              Users
            </Link>
            .
          </p>
        ) : null}
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <Link
            key={c.href}
            href={c.href}
            className="rounded-md border border-border-subtle bg-bg-raised p-4 transition-colors hover:border-border-default"
          >
            <h2 className="text-sm font-semibold text-fg-primary">{c.title}</h2>
            <p className="mt-1 text-[12px] leading-snug text-fg-muted">{c.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
