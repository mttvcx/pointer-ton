'use client';

import { useQuery } from '@tanstack/react-query';
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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold">Dashboard</h1>
        <p className="text-[13px] text-fg-muted">Track your performance and earnings</p>
      </div>

      {data ? (
        <>
          <div className="rounded-lg border border-border-subtle bg-bg-raised p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-fg-muted">Submission window</p>
            <p className="mt-2 font-mono text-2xl font-semibold tabular-nums tracking-tight">
              {formatCountdown(data.countdownMs)}
            </p>
            <p className="mt-1 text-[12px] text-fg-muted">remaining to submit for {data.monthKey}</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { label: 'Verified earnings', value: `$${data.stats.verifiedEarningsUsd.toFixed(2)}` },
              { label: 'Unverified earnings', value: `$${data.stats.unverifiedEarningsUsd.toFixed(2)}` },
              { label: 'Posts', value: String(data.stats.posts) },
              { label: 'Views', value: data.stats.views.toLocaleString() },
            ].map((c) => (
              <div key={c.label} className="rounded-lg border border-border-subtle bg-bg-raised p-4">
                <p className="text-[11px] text-fg-muted">{c.label}</p>
                <p className="mt-1 text-xl font-semibold tabular-nums">{c.value}</p>
              </div>
            ))}
          </div>

          <CreatorAccountsPanel accounts={data.accounts} showAddForm={false} />
        </>
      ) : null}
    </div>
  );
}
