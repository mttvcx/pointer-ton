'use client';

import { Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

export interface LeaderboardFiltersProps {
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function LeaderboardFilters({ value, onChange, className }: LeaderboardFiltersProps) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2 border-b border-border-subtle pb-3',
        className,
      )}
    >
      <div className="relative min-w-[200px] flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-muted" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search username or wallet"
          className="w-full rounded-sm border border-border-subtle bg-bg-base py-1.5 pl-8 pr-8 text-[13px] text-fg-primary placeholder:text-fg-muted focus-ring"
          autoComplete="off"
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded px-1 text-[10px] text-fg-muted hover:text-fg-secondary"
          >
            Clear
          </button>
        ) : null}
      </div>
      <p className="hidden text-[10px] text-fg-muted lg:block">
        Rankings refresh every few minutes. Points are non-transferable and non-monetary.
      </p>
    </div>
  );
}
