'use client';

import { cn } from '@/lib/utils/cn';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CELL_MUTED_CLASS } from './deskTokens';

export function DeskMissingValue({
  tooltip,
  className,
  children = '\u2014',
}: {
  tooltip: string;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={cn(
            CELL_MUTED_CLASS,
            'cursor-help border-b border-dotted border-fg-muted/30',
            className,
          )}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[220px] text-[10px] leading-snug">
        {tooltip}
      </TooltipContent>
    </Tooltip>
  );
}
