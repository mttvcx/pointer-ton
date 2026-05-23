'use client';

import { cn } from '@/lib/utils/cn';
import { DESK_HEADER_CLASS, DESK_HEADER_NUM_CLASS } from './deskTokens';

export function SortIndicator({ sortDir }: { sortDir?: 'asc' | 'desc' | null }) {
  const icon = sortDir === 'asc' ? '↑' : sortDir === 'desc' ? '↓' : '↕';
  return (
    <span
      className={cn(
        'text-[10px] font-normal leading-none',
        sortDir ? 'text-fg-secondary' : 'text-fg-muted/40',
      )}
      aria-hidden
    >
      {icon}
    </span>
  );
}

type SortableThProps = {
  label: React.ReactNode;
  sortDir?: 'asc' | 'desc' | null;
  onSort?: () => void;
  align?: 'left' | 'right';
  className?: string;
};

export function SortableTh({
  label,
  sortDir = null,
  onSort,
  align = 'left',
  className,
}: SortableThProps) {
  const base = align === 'right' ? DESK_HEADER_NUM_CLASS : DESK_HEADER_CLASS;

  if (!onSort) {
    return (
      <th className={cn(base, className)}>
        <span
          className={cn(
            'inline-flex items-center gap-1',
            align === 'right' && 'ml-auto',
          )}
        >
          {label}
          <SortIndicator sortDir={sortDir} />
        </span>
      </th>
    );
  }

  return (
    <th className={cn(base, className)}>
      <button
        type="button"
        onClick={onSort}
        className={cn(
          'inline-flex items-center gap-1 hover:text-fg-primary',
          align === 'right' && 'ml-auto',
        )}
      >
        {label}
        <SortIndicator sortDir={sortDir} />
      </button>
    </th>
  );
}
