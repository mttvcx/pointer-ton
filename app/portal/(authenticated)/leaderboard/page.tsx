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
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Leaderboard</h1>
          <p className="mt-0.5 text-[13px] text-fg-muted">Monthly prize pool + rankings</p>
        </div>
        <div className="creator-glass-quiet flex rounded-full p-1 text-[11px]">
          <button
            type="button"
            onClick={() => setVerifiedOnly(true)}
            className={
              verifiedOnly
                ? 'rounded-full bg-accent-primary/20 px-3.5 py-1 font-semibold text-accent-glow ring-1 ring-inset ring-accent-primary/30'
                : 'px-3.5 py-1 text-fg-muted transition-colors hover:text-fg-secondary'
            }
          >
            Verified
          </button>
          <button
            type="button"
            onClick={() => setVerifiedOnly(false)}
            className={
              !verifiedOnly
                ? 'rounded-full bg-accent-primary/20 px-3.5 py-1 font-semibold text-accent-glow ring-1 ring-inset ring-accent-primary/30'
                : 'px-3.5 py-1 text-fg-muted transition-colors hover:text-fg-secondary'
            }
          >
            Unverified
          </button>
        </div>
      </div>

      {data ? (
        <>
          <div className="creator-glass-strong rounded-2xl p-6 text-center">
            <p className="text-[11px] uppercase tracking-[0.14em] text-fg-muted">Prize pool</p>
            <p className="creator-gradient-text mt-1.5 text-4xl font-semibold tabular-nums">
              ${data.prizePoolUsd.toFixed(0)}
            </p>
          </div>
          <ol className="creator-glass divide-y divide-white/[0.05] overflow-hidden rounded-2xl">
            {data.rankings.map((r) => {
              const medal =
                r.rank === 1
                  ? 'text-[#ffd35a]'
                  : r.rank === 2
                    ? 'text-[#cbd5e1]'
                    : r.rank === 3
                      ? 'text-[#d69a5c]'
                      : 'text-fg-muted';
              return (
                <li
                  key={r.rank}
                  className="flex items-center justify-between px-4 py-3 text-[13px] transition-colors hover:bg-white/[0.02]"
                >
                  <span className="flex items-center gap-2.5">
                    <span className={`w-7 font-mono text-[13px] font-semibold tabular-nums ${medal}`}>
                      #{r.rank}
                    </span>
                    <span className="font-medium">{r.username}</span>
                  </span>
                  <span className="tabular-nums text-fg-secondary">
                    {formatCompactUsd(r.views).replace('$', '')} views
                  </span>
                </li>
              );
            })}
            {data.rankings.length === 0 ? (
              <li className="px-4 py-8 text-center text-[13px] text-fg-muted">No ranked creators yet.</li>
            ) : null}
          </ol>
        </>
      ) : (
        <div className="space-y-4">
          <div className="creator-glass h-28 animate-pulse rounded-2xl" />
          <div className="creator-glass h-64 animate-pulse rounded-2xl" />
        </div>
      )}
    </div>
  );
}
