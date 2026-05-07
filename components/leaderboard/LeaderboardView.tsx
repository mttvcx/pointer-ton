'use client';

import { useCallback, useDeferredValue, useState } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { LeaderboardFilters } from '@/components/leaderboard/LeaderboardFilters';
import { LeaderboardTopCards } from '@/components/leaderboard/LeaderboardTopCards';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { cn } from '@/lib/utils/cn';
import type { LeaderboardPageResult } from '@/lib/points/leaderboardTypes';

async function fetchLeaderboard(
  token: string,
  params: { page: number; pageSize: number; q: string },
): Promise<LeaderboardPageResult> {
  const u = new URL('/api/points/leaderboard', window.location.origin);
  u.searchParams.set('page', String(params.page));
  u.searchParams.set('pageSize', String(params.pageSize));
  if (params.q.trim()) u.searchParams.set('q', params.q.trim());
  const res = await fetch(u.toString(), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error ?? `leaderboard_${res.status}`);
  }
  return res.json() as Promise<LeaderboardPageResult>;
}

const PAGE_SIZE = 25;

export interface LeaderboardViewProps {
  className?: string;
}

export function LeaderboardView({ className }: LeaderboardViewProps) {
  const { getAccessToken } = usePointerAuth();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const search = useDeferredValue(searchInput.trim());

  const queryKey = ['points-leaderboard', page, PAGE_SIZE, search] as const;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey,
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) throw new Error('no_token');
      return fetchLeaderboard(token, { page, pageSize: PAGE_SIZE, q: search });
    },
  });

  const onSearchChange = useCallback((v: string) => {
    setSearchInput(v);
    setPage(1);
  }, []);

  const viewerPointerId = data?.you?.user_id ?? null;

  const tablePage = data?.page ?? page;
  const onPrev = () =>
    setPage((p) => Math.max(1, (data?.page ?? p) - 1));
  const onNext = () => {
    if (!data || data.page >= data.tablePages) return;
    setPage(data.page + 1);
  };

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-4', className)}>
      <LeaderboardFilters value={searchInput} onChange={onSearchChange} />

      {data?.you ? (
        <div className="rounded-md border border-border-subtle bg-bg-base px-3 py-2">
          <p className="text-[10px] font-medium uppercase tracking-wide text-fg-muted">Your rank</p>
          <p className="mt-0.5 tabular-nums text-sm tabular-nums text-fg-primary">
            #{data.you.rank}
            <span className="mx-1 text-fg-muted">|</span>
            <span className="font-semibold">
              {Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 }).format(
                data.you.total_points,
              )}
            </span>{' '}
            pts
          </p>
        </div>
      ) : !isLoading && data && !data.you ? (
        <p className="text-[11px] text-fg-muted">
          Complete a points-earning action to appear on the board.
        </p>
      ) : null}

      {isLoading ? (
        <div className="flex flex-1 items-center justify-center py-16 text-fg-muted">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : isError ? (
        <div className="rounded-md border border-border-subtle px-4 py-6 text-center text-[13px] text-signal-bear">
          {error instanceof Error ? error.message : 'Could not load leaderboard'}
          <button
            type="button"
            onClick={() => void refetch()}
            className="mt-3 block w-full rounded-sm border border-border-subtle py-1.5 text-fg-secondary hover:bg-bg-hover sm:mx-auto sm:w-auto sm:px-4"
          >
            Retry
          </button>
        </div>
      ) : data ? (
        <>
          <LeaderboardTopCards podium={data.podium} youId={viewerPointerId} />
          <div className="min-h-0 flex flex-1 flex-col">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-fg-muted">
              Full rankings
            </h2>
            <LeaderboardTable
              rows={data.rows}
              youId={viewerPointerId}
              page={tablePage}
              tablePages={data.tablePages}
              onPrev={onPrev}
              onNext={onNext}
              className="min-h-[200px]"
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
