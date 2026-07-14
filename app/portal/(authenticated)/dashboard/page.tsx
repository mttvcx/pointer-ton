'use client';

import { useQuery } from '@tanstack/react-query';
import { BadgeCheck, Clock3, Eye, FileVideo, Hourglass } from 'lucide-react';
import { CreatorAccountsPanel } from '@/components/creators/CreatorAccountsPanel';
import type { CreatorPlatform } from '@/lib/creators/config';

function formatCountdown(ms: number) {
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${String(d).padStart(2, '0')}d : ${String(h).padStart(2, '0')}h : ${String(m).padStart(2, '0')}m : ${String(sec).padStart(2, '0')}s`;
}

export default function CreatorDashboardPage() {
  const q = useQuery({
    queryKey: ['creator-me'],
    queryFn: async () => {
      const res = await fetch('/api/creators/me');
      if (!res.ok) throw new Error('failed');
      return res.json() as Promise<{
        monthKey: string;
        countdownMs: number;
        stats: {
          verifiedEarningsUsd: number;
          unverifiedEarningsUsd: number;
          posts: number;
          views: number;
        };
        accounts: Array<{
          id: string;
          platform: CreatorPlatform;
          handle: string;
          verification_status: string;
          tier: string | null;
        }>;
      }>;
    },
  });

  const data = q.data;

  const cards = data
    ? [
        {
          label: 'Verified earnings',
          value: `$${data.stats.verifiedEarningsUsd.toFixed(2)}`,
          icon: BadgeCheck,
          tint: 'text-signal-bull',
        },
        {
          label: 'Unverified earnings',
          value: `$${data.stats.unverifiedEarningsUsd.toFixed(2)}`,
          icon: Hourglass,
          tint: 'text-signal-warn',
        },
        { label: 'Posts', value: String(data.stats.posts), icon: FileVideo, tint: 'text-accent-glow' },
        { label: 'Views', value: data.stats.views.toLocaleString(), icon: Eye, tint: 'text-accent-glow' },
      ]
    : [];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Dashboard</h1>
        <p className="mt-0.5 text-[13px] text-fg-muted">Track your performance and earnings</p>
      </div>

      {data ? (
        <>
          <div className="creator-glass-strong relative overflow-hidden rounded-2xl p-5">
            <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-fg-muted">
              <Clock3 className="h-3.5 w-3.5 text-accent-glow" strokeWidth={2.5} />
              Submission window
            </div>
            <p className="creator-gradient-text mt-3 font-mono text-[34px] font-semibold leading-none tabular-nums tracking-tight sm:text-[40px]">
              {formatCountdown(data.countdownMs)}
            </p>
            <p className="mt-2.5 text-[12px] text-fg-muted">
              remaining to submit for <span className="font-medium text-fg-secondary">{data.monthKey}</span>
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {cards.map((c) => (
              <div key={c.label} className="creator-glass creator-lift rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <p className="text-[11px] font-medium text-fg-muted">{c.label}</p>
                  <c.icon className={`h-4 w-4 ${c.tint}`} strokeWidth={2} />
                </div>
                <p className="mt-2 text-2xl font-semibold tabular-nums tracking-tight">{c.value}</p>
              </div>
            ))}
          </div>

          <CreatorAccountsPanel accounts={data.accounts} showAddForm={false} />
        </>
      ) : (
        <div className="space-y-6">
          <div className="creator-glass h-28 animate-pulse rounded-2xl" />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="creator-glass h-24 animate-pulse rounded-xl" />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
