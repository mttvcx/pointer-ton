'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { formatCompactUsd } from '@/lib/utils/formatters';

export default function CreatorLeaderboardPage() {
  const [verifiedOnly, setVerifiedOnly] = useState(true);
  const q = useQuery({
    queryKey: ['creator-leaderboard', verifiedOnly],
    queryFn: async () => {
      const qs = verifiedOnly ? '' : '?verified=0';
      const res = await fetch(`/api/creators/leaderboard${qs}`);
      return res.json() as Promise<{
        prizePoolUsd: number;
        rankings: Array<{ rank: number; username: string; views: number; earningsUsd: number }>;
      }>;
    },
  });

  const data = q.data;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Leaderboard</h1>
          <p className="text-[13px] text-fg-muted">Monthly prize pool + rankings</p>
        </div>
        <div className="flex rounded-md border border-border-subtle p-0.5 text-[11px]">
          <button
            type="button"
            onClick={() => setVerifiedOnly(true)}
            className={verifiedOnly ? 'rounded bg-bg-hover px-3 py-1 font-semibold' : 'px-3 py-1 text-fg-muted'}
          >
            Verified
          </button>
          <button
            type="button"
            onClick={() => setVerifiedOnly(false)}
            className={!verifiedOnly ? 'rounded bg-bg-hover px-3 py-1 font-semibold' : 'px-3 py-1 text-fg-muted'}
          >
            Unverified
          </button>
        </div>
      </div>

      {data ? (
        <>
          <div className="rounded-lg border border-border-subtle bg-bg-raised p-4 text-center">
            <p className="text-[11px] uppercase tracking-wide text-fg-muted">Prize pool</p>
            <p className="mt-1 text-3xl font-semibold tabular-nums">${data.prizePoolUsd.toFixed(0)}</p>
          </div>
          <ol className="divide-y divide-border-subtle rounded-lg border border-border-subtle">
            {data.rankings.map((r) => (
              <li key={r.rank} className="flex items-center justify-between px-4 py-3 text-[13px]">
                <span>
                  <span className="mr-2 font-mono tabular-nums text-fg-muted">#{r.rank}</span>
                  {r.username}
                </span>
                <span className="tabular-nums text-fg-secondary">
                  {formatCompactUsd(r.views).replace('$', '')} views
                </span>
              </li>
            ))}
          </ol>
        </>
      ) : null}
    </div>
  );
}
