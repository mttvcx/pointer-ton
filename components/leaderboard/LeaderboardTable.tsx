'use client';

import Link from 'next/link';
import { cn } from '@/lib/utils/cn';
import { shortenAddress } from '@/lib/utils/addresses';
import { formatNumber } from '@/lib/utils/formatters';
import type { LeaderboardEntry } from '@/lib/points/leaderboardTypes';

function displayName(entry: LeaderboardEntry): string {
  if (entry.username?.trim()) return entry.username.trim();
  if (entry.wallet_address) return shortenAddress(entry.wallet_address, 5);
  return 'Trader';
}

export interface LeaderboardTableProps {
  rows: LeaderboardEntry[];
  youId: string | null;
  page: number;
  tablePages: number;
  onPrev: () => void;
  onNext: () => void;
  className?: string;
}

export function LeaderboardTable({
  rows,
  youId,
  page,
  tablePages,
  onPrev,
  onNext,
  className,
}: LeaderboardTableProps) {
  if (tablePages === 0) {
    return (
      <div
        className={cn('rounded-md border border-border-subtle px-4 py-8 text-center', className)}
      >
        <p className="text-[12px] text-fg-muted">Everyone is on the podium; no extra rows.</p>
      </div>
    );
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col border border-border-subtle', className)}>
      <div className="overflow-auto">
        <table className="w-full border-collapse text-left text-[13px]">
          <thead className="sticky top-0 z-[1] border-b border-border-subtle bg-bg-base">
            <tr className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
              <th className="px-3 py-2 font-medium">Rank</th>
              <th className="px-3 py-2 font-medium">Trader</th>
              <th className="px-3 py-2 text-right font-medium">Points</th>
              <th className="hidden px-3 py-2 text-right font-medium sm:table-cell">Active days</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const href =
                row.wallet_address && !row.wallet_address.startsWith('privy:')
                  ? `/wallet/${encodeURIComponent(row.wallet_address)}`
                  : null;
              const isYou = youId === row.user_id;
              return (
                <tr
                  key={row.user_id}
                  className={cn(
                    'border-b border-border-subtle last:border-b-0 transition-colors hover:bg-bg-hover/60',
                    isYou && 'bg-accent-primary/[0.06]',
                  )}
                >
                  <td className="px-3 py-2.5 tabular-nums text-fg-secondary tabular-nums">{row.rank}</td>
                  <td className="max-w-[200px] px-3 py-2.5">
                    {href ? (
                      <Link href={href} className="block focus-ring rounded-sm">
                        <span className="block truncate font-medium text-fg-primary">
                          {displayName(row)}
                        </span>
                        <span className="block truncate tabular-nums text-[11px] text-fg-muted tabular-nums">
                          {row.wallet_address ? shortenAddress(row.wallet_address, 5) : '-'}
                        </span>
                      </Link>
                    ) : (
                      <>
                        <span className="block truncate font-medium text-fg-primary">
                          {displayName(row)}
                        </span>
                        <span className="block truncate tabular-nums text-[11px] text-fg-muted tabular-nums">
                          {row.wallet_address ? shortenAddress(row.wallet_address, 5) : '-'}
                        </span>
                      </>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium tabular-nums text-fg-primary">
                    {formatNumber(row.total_points, { compact: true, decimals: 1 })}
                  </td>
                  <td className="hidden px-3 py-2.5 text-right tabular-nums text-fg-secondary tabular-nums sm:table-cell">
                    {row.active_days}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-border-subtle px-3 py-2">
        <span className="text-[11px] text-fg-muted">
          Page {page} of {tablePages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onPrev}
            disabled={page <= 1}
            className="rounded-sm border border-border-subtle px-2 py-1 text-[11px] font-medium text-fg-secondary transition-colors enabled:hover:border-border-default enabled:hover:text-fg-primary disabled:opacity-40"
          >
            Previous
          </button>
          <button
            type="button"
            onClick={onNext}
            disabled={page >= tablePages}
            className="rounded-sm border border-border-subtle px-2 py-1 text-[11px] font-medium text-fg-secondary transition-colors enabled:hover:border-border-default enabled:hover:text-fg-primary disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
