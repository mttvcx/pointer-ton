'use client';

import { cn } from '@/lib/utils/cn';

type DeskFilterPillProps = {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
};

export function DeskFilterPill({ active, onClick, children }: DeskFilterPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'btn-press inline-flex h-6 shrink-0 items-center rounded-md px-2.5 text-[11px] font-medium transition-colors',
        active ? 'bg-bg-hover text-fg-primary' : 'text-fg-muted hover:text-fg-primary',
      )}
    >
      {children}
    </button>
  );
}
