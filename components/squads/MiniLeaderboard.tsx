'use client';

import type { RailEntry } from '@/lib/squads/sampleData';

interface Props {
  title: string;
  entries: RailEntry[];
  /** Optional secondary label rendered to the right of the title (e.g. "7d"). */
  hint?: string;
}

/**
 * Compact right-rail leaderboard. Used 4× in the Squads discovery view —
 * content swaps based on the Traders | Squads toggle.
 */
export function MiniLeaderboard({ title, entries, hint }: Props) {
  return (
    <section className="rounded-lg border border-border-subtle bg-bg-raised p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className="text-[10px] font-bold uppercase tracking-wider text-fg-muted">{title}</h3>
        {hint ? (
          <span className="text-[10px] font-medium uppercase tracking-wider text-fg-muted/70">
            {hint}
          </span>
        ) : null}
      </div>
      <ul className="space-y-1">
        {entries.slice(0, 5).map((e, i) => (
          <li key={e.handle} className="flex items-center gap-2 text-xs">
            <span className="w-4 shrink-0 text-[10px] tabular-nums text-fg-muted">{i + 1}</span>
            <span className="flex-1 cursor-pointer truncate text-fg-secondary transition-colors hover:text-fg-primary">
              {e.handle}
            </span>
            <span className="shrink-0 text-[10px] tabular-nums text-fg-muted">{e.delta}</span>
            <span className="shrink-0 text-xs font-semibold tabular-nums text-fg-primary">
              {e.value}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
