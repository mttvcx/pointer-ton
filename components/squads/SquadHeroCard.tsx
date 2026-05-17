'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { SquadSample } from '@/lib/squads/sampleData';
import { HeroSparkline, HeroStat, formatCurrency } from '@/components/squads/squadsCardShared';

interface Props {
  squad: SquadSample;
  rank: number;
}

export function SquadHeroCard({ squad, rank }: Props) {
  const [moreOpen, setMoreOpen] = useState(false);
  const pnlPositive = squad.pnl30d >= 0;
  const pnlFormatted = formatCurrency(squad.pnl30d);
  const volumeFormatted = formatCurrency(squad.volume30d);

  return (
    <article
      className={cn(
        'relative rounded-lg border bg-bg-raised p-3 transition-colors hover:bg-bg-hover sm:p-4',
        rank === 1 ? 'border-accent-ethos/35' : 'border-border-subtle',
      )}
    >
      <div className="absolute -left-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full border border-border-subtle bg-bg-base text-[10px] font-bold tabular-nums text-fg-primary sm:-left-2 sm:-top-2 sm:h-7 sm:w-7 sm:text-xs">
        #{rank}
      </div>

      <div className="flex items-start gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-border-subtle bg-bg-sunken text-lg leading-none sm:h-12 sm:w-12 sm:text-xl">
          <span aria-hidden>{squad.emblem}</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <h3 className="text-[13px] font-bold leading-tight text-fg-primary">{squad.displayName}</h3>
            <span className="text-[11px] text-fg-muted">{squad.handle}</span>
            <span className="rounded bg-bg-sunken px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-fg-muted">
              Squad
            </span>
            {squad.ethosVerified ? (
              <span className="rounded bg-accent-ethos/15 px-1 py-px text-[9px] font-semibold uppercase tracking-wide text-accent-ethos">
                ✓ Ethos
              </span>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 flex-col items-end tabular-nums">
          <span className="text-[9px] font-semibold uppercase tracking-wider text-fg-muted">PnL 30d</span>
          <span
            className={cn(
              'flex items-center gap-0.5 text-lg font-bold sm:text-xl',
              pnlPositive ? 'text-signal-bull' : 'text-signal-bear',
            )}
          >
            {pnlPositive ? (
              <TrendingUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            ) : (
              <TrendingDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" aria-hidden />
            )}
            {pnlFormatted}
          </span>
          <span className="text-[9px] text-fg-muted">Vol {volumeFormatted}</span>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <button
          type="button"
          className="h-7 rounded bg-accent-primary px-3 text-[11px] font-semibold text-fg-inverse transition-colors hover:bg-accent-glow sm:h-8"
        >
          Follow
        </button>
        <button
          type="button"
          className="flex h-7 items-center gap-0.5 rounded px-2 text-[11px] font-medium text-fg-secondary transition-colors hover:bg-bg-hover hover:text-fg-primary sm:h-8"
        >
          Profile <ChevronRight className="h-3 w-3" aria-hidden />
        </button>
        <button
          type="button"
          onClick={() => setMoreOpen((v) => !v)}
          className={cn(
            'ml-auto flex h-7 items-center gap-1 rounded border border-border-subtle bg-bg-base px-2.5 text-[11px] font-medium text-fg-muted transition-colors',
            'hover:border-border hover:text-fg-secondary sm:h-8',
          )}
          aria-expanded={moreOpen}
        >
          {moreOpen ? 'Less' : 'Charts & detail'}
          <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', moreOpen && 'rotate-180')} />
        </button>
      </div>

      {moreOpen ? (
        <div className="mt-3 space-y-3 border-t border-border-subtle pt-3">
          {squad.bio.trim() ? <p className="text-[11px] leading-snug text-fg-secondary">{squad.bio}</p> : null}
          {squad.tags.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {squad.tags.slice(0, 6).map((t) => (
                <span
                  key={t}
                  className="inline-flex h-5 items-center rounded border border-border-subtle bg-bg-sunken px-1.5 text-[10px] font-medium text-fg-muted"
                >
                  {t}
                </span>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap items-center gap-4 gap-y-2">
            <HeroSparkline values={squad.pnlSparkline} positive={pnlPositive} />
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px]">
              <HeroStat label="Win" value={`${squad.winRate}%`} />
              <HeroStat label="Members" value={squad.memberCount} />
              <HeroStat label="Active" value={`${squad.activeDays}d`} />
              <HeroStat label="Trust" value={squad.trustScore} accent />
            </div>
          </div>
          {squad.topMembers.length > 0 ? (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-border-subtle/60 pt-2.5 text-[11px]">
              <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                <Users className="h-3 w-3" aria-hidden />
                Top operators
              </span>
              {squad.topMembers.slice(0, 5).map((handle, i, arr) => (
                <span key={handle} className="font-semibold text-fg-secondary">
                  {handle}
                  {i < arr.length - 1 ? <span className="px-1 text-fg-muted/50">·</span> : null}
                </span>
              ))}
              <span className="basis-full pt-1 text-fg-muted sm:basis-auto sm:ml-auto sm:pt-0">{squad.lastActiveLabel}</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
