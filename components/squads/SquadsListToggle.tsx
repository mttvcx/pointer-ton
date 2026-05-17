'use client';

import { cn } from '@/lib/utils/cn';

export type SquadsViewMode = 'traders' | 'squads';

interface Props {
  mode: SquadsViewMode;
  onChange: (mode: SquadsViewMode) => void;
}

/**
 * Segmented control that flips the discovery list (and the right-rail mini
 * leaderboards) between individual traders and group squads. Default is
 * `'traders'` — set by the parent's initial state.
 */
export function SquadsListToggle({ mode, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="Discovery mode"
      className="inline-flex items-center gap-0.5 rounded-md border border-border-subtle bg-bg-sunken p-0.5"
    >
      {(['traders', 'squads'] as const).map((opt) => {
        const active = mode === opt;
        return (
          <button
            key={opt}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(opt)}
            className={cn(
              'h-7 rounded px-3 text-xs font-semibold capitalize transition-colors',
              active
                ? 'bg-bg-raised text-fg-primary shadow-sm'
                : 'text-fg-muted hover:text-fg-secondary',
            )}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
