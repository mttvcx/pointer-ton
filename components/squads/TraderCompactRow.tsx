'use client';

import { TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { TraderSample } from '@/lib/squads/sampleData';
import { SquadAvatar } from '@/components/squads/squadsPrimitives';
import { formatCurrency } from '@/components/squads/squadsCardShared';

interface Props {
  trader: TraderSample;
  rank: number;
}

/**
 * Compact trader row — same data as TraderHeroCard, lower visual weight,
 * single line on `md+`.
 */
export function TraderCompactRow({ trader, rank }: Props) {
  const pnlPositive = trader.pnl30d >= 0;
  return (
    <article className="flex items-center gap-3 rounded border border-border-subtle/40 bg-bg-raised px-3 py-2.5 transition-colors hover:bg-bg-hover">
      <span className="w-6 shrink-0 text-xs font-bold tabular-nums text-fg-muted">#{rank}</span>

      <SquadAvatar seed={trader.id} initials={trader.initials} size="md" />

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-xs font-semibold text-fg-primary">{trader.displayName}</h3>
          <span className="truncate text-[10px] text-fg-muted">{trader.handle}</span>
          {trader.ethosVerified ? (
            <span className="shrink-0 text-[9px] font-semibold uppercase text-accent-ethos">
              ✓
            </span>
          ) : null}
        </div>
      </div>

      <div className="hidden items-center gap-4 text-[11px] md:flex">
        <span className="text-fg-muted">{trader.winRate}% win</span>
        <span className="text-fg-muted">{trader.activeDays}d active</span>
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
          {formatCurrency(trader.pnl30d)}
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
