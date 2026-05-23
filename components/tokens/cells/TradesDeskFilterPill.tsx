'use client';

import { Filter, UserRound, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { TradesDeskFilter } from '@/lib/tokens/tradeFormatting';

const ICONS: Record<Exclude<TradesDeskFilter, 'all'>, LucideIcon> = {
  dev: Filter,
  tracked: Filter,
  you: UserRound,
};

type Props = {
  id: Exclude<TradesDeskFilter, 'all'>;
  label: string;
  active: boolean;
  onClick: () => void;
};

export function TradesDeskFilterPill({ id, label, active, onClick }: Props) {
  const Icon = ICONS[id];
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'btn-press inline-flex h-6 shrink-0 items-center gap-1 rounded-md px-2 text-[11px] font-semibold uppercase tracking-wide transition-colors',
        active ? 'bg-bg-hover text-fg-primary' : 'text-fg-muted hover:text-fg-primary',
      )}
    >
      {label}
      <Icon className="h-3 w-3 shrink-0 opacity-70" strokeWidth={2} aria-hidden />
    </button>
  );
}
