'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { SquadSample } from '@/lib/squads/sampleData';
import { formatCurrency } from '@/components/squads/squadsCardShared';

interface Props {
  squad: SquadSample;
  rank: number;
}

/** Compact squad row — emblem + member count, otherwise mirrors TraderCompactRow. */
export function SquadCompactRow({ squad, rank }: Props) {
  const pnlPositive = squad.pnl30d >= 0;
  return (
    <article className="flex items-center gap-3 rounded border border-border-subtle/40 bg-bg-raised px-3 py-2.5 transition-colors hover:bg-bg-hover">
      <span className="w-6 shrink-0 text-xs font-bold tabular-nums text-fg-muted">#{rank}</span>

      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border-subtle bg-bg-sunken text-base">
        <span aria-hidden>{squad.emblem}</span>
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-xs font-semibold text-fg-primary">{squad.displayName}</h3>
          <span className="truncate text-[10px] text-fg-muted">{squad.handle}</span>
          {squad.ethosVerified ? (
            <span className="shrink-0 text-[9px] font-semibold uppercase text-accent-ethos">
              ✓
            </span>
          ) : null}
        </div>
      </div>

      <div className="hidden items-center gap-4 text-[11px] md:flex">
        <span className="text-fg-muted">{squad.winRate}% win</span>
        <span className="text-fg-muted">{squad.memberCount} members</span>
      </div>

      <div className="flex shrink-0 flex-col items-end">
        <span
          className={cn(
            'flex items-center gap-0.5 text-sm font-bold tabular-nums',
            pnlPositive ? 'text-signal-bull' : 'text-signal-bear',
          )}
        >
          {pnlPositive ? (
            <TrendingUp className="h-3 w-3" aria-hidden />
          ) : (
            <TrendingDown className="h-3 w-3" aria-hidden />
          )}
          {formatCurrency(squad.pnl30d)}
        </span>
        <span className="text-[9px] text-fg-muted">PnL 30d</span>
      </div>

      <button
        type="button"
        className="h-7 shrink-0 rounded bg-accent-primary/15 px-2 text-[11px] font-semibold text-accent-primary transition-colors hover:bg-accent-primary hover:text-fg-inverse"
      >
        Follow
      </button>
    </article>
  );
}
