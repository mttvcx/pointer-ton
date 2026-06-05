'use client';

import { Filter, SlidersHorizontal } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';

type Props = {
  onClick: () => void;
  active?: boolean;
  className?: string;
  icon?: 'filter' | 'sliders';
};

/** Funnel / sliders — filters the Trades tab to this wallet on the current mint (Axiom parity). */
export function WalletMintTradesFilterButton({
  onClick,
  active,
  className,
  icon = 'filter',
}: Props) {
  const Icon = icon === 'sliders' ? SlidersHorizontal : Filter;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onClick();
          }}
          className={cn(
            'btn-press inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm transition-colors',
            active
              ? 'bg-signal-info/15 text-signal-info'
              : 'text-fg-muted/50 hover:bg-bg-hover hover:text-fg-primary',
            className,
          )}
          aria-label="Filter by address"
        >
          <Icon className="h-3 w-3" strokeWidth={2} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-[10px]">
        Filter by Address
      </TooltipContent>
    </Tooltip>
  );
}
