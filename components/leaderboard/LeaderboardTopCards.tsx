'use client';

import Link from 'next/link';
import { Trophy } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { shortenAddress } from '@/lib/utils/addresses';
import { formatNumber } from '@/lib/utils/formatters';
import type { LeaderboardEntry } from '@/lib/points/leaderboardTypes';

function displayName(entry: LeaderboardEntry): string {
  if (entry.username?.trim()) return entry.username.trim();
  if (entry.wallet_address) return shortenAddress(entry.wallet_address, 5);
  return 'Trader';
}

interface PodiumCardProps {
  entry: LeaderboardEntry;
  placing: 1 | 2 | 3;
  emphasize?: boolean;
  highlightYou?: boolean;
}

function PodiumCard({ entry, placing, emphasize, highlightYou }: PodiumCardProps) {
  const href =
    entry.wallet_address && !entry.wallet_address.startsWith('privy:')
      ? `/wallet/${encodeURIComponent(entry.wallet_address)}`
      : null;

  const inner = (
    <div
      className={cn(
        'relative flex flex-col justify-end overflow-hidden rounded-md border bg-bg-base px-4 pb-4 pt-10 transition-all duration-200',
        emphasize
          ? 'min-h-[168px] border-accent-primary/40 shadow-[0_0_32px_rgb(var(--accent-primary-rgb)/0.12)]'
          : 'min-h-[132px] border-border-subtle',
        highlightYou && 'ring-1 ring-accent-primary/60',
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0 opacity-90',
          placing === 1 &&
            'bg-[radial-gradient(ellipse_at_50%_0%,rgba(0,119,182,0.22),transparent_55%)]',
          placing === 2 &&
            'bg-[radial-gradient(ellipse_at_50%_0%,rgba(93,235,181,0.12),transparent_50%)]',
          placing === 3 &&
            'bg-[radial-gradient(ellipse_at_50%_0%,rgba(94,187,255,0.12),transparent_50%)]',
        )}
      />
      <div className="relative flex items-start justify-between gap-2">
        <span
          className={cn(
            'flex h-8 w-8 shrink-0 items-center justify-center rounded-sm border tabular-nums text-xs font-semibold tabular-nums',
            placing === 1
              ? 'border-accent-primary/50 bg-accent-primary/15 text-accent-primary'
              : 'border-border-subtle text-fg-secondary',
          )}
        >
          {placing}
        </span>
        {placing === 1 ? (
          <Trophy className="h-5 w-5 text-accent-primary opacity-90" strokeWidth={2} />
        ) : null}
      </div>
      <p className="relative mt-3 truncate text-sm font-semibold text-fg-primary">
        {displayName(entry)}
      </p>
      <p className="relative mt-0.5 truncate tabular-nums text-[11px] text-fg-muted tabular-nums">
        {entry.wallet_address ? shortenAddress(entry.wallet_address, 5) : '-'}
      </p>
      <p className="relative mt-3 tabular-nums text-lg font-semibold tabular-nums text-fg-primary">
        {formatNumber(entry.total_points, { compact: true, decimals: 1 })}
        <span className="ml-1 text-[10px] font-medium uppercase tracking-wide text-fg-muted">
          pts
        </span>
      </p>
      <p className="relative mt-0.5 text-[10px] text-fg-secondary">
        {entry.active_days} active {entry.active_days === 1 ? 'day' : 'days'}
      </p>
    </div>
  );

  if (href) {
    return (
      <Link href={href} className="block min-w-0 focus-ring rounded-md">
        {inner}
      </Link>
    );
  }
  return inner;
}

export interface LeaderboardTopCardsProps {
  podium: LeaderboardEntry[];
  youId: string | null;
  className?: string;
}

/**
 * Vision-style podium: #2 (left), #1 (center, elevated), #3 (right).
 */
export function LeaderboardTopCards({ podium, youId, className }: LeaderboardTopCardsProps) {
  if (podium.length === 0) {
    return (
      <div
        className={cn(
          'rounded-md border border-dashed border-border-subtle px-6 py-12 text-center',
          className,
        )}
      >
        <p className="text-sm text-fg-secondary">No ranked traders yet.</p>
        <p className="mt-1 text-[11px] text-fg-muted">
          Points events will appear here after the first awards.
        </p>
      </div>
    );
  }

  const first = podium[0];
  const second = podium[1];
  const third = podium[2];

  if (podium.length === 1 && first) {
    return (
      <div className={cn('mx-auto max-w-sm', className)}>
        <PodiumCard
          entry={first}
          placing={1}
          emphasize
          highlightYou={youId === first.user_id}
        />
      </div>
    );
  }

  if (podium.length === 2 && first && second) {
    return (
      <div className={cn('grid grid-cols-2 items-end gap-3 md:mx-auto md:max-w-xl', className)}>
        <PodiumCard entry={second} placing={2} highlightYou={youId === second.user_id} />
        <PodiumCard
          entry={first}
          placing={1}
          emphasize
          highlightYou={youId === first.user_id}
        />
      </div>
    );
  }

  if (first && second && third) {
    return (
      <div className={cn('grid grid-cols-3 items-end gap-2 sm:gap-3', className)}>
        <PodiumCard entry={second} placing={2} highlightYou={youId === second.user_id} />
        <PodiumCard
          entry={first}
          placing={1}
          emphasize
          highlightYou={youId === first.user_id}
        />
        <PodiumCard entry={third} placing={3} highlightYou={youId === third.user_id} />
      </div>
    );
  }

  return null;
}
