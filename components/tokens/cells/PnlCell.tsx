'use client';

import { cn } from '@/lib/utils/cn';
import {
  CELL_PRIMARY_CLASS,
  CELL_HERO_CLASS,
} from './deskTokens';

export type PnlCellProps = {
  value: number;
  display: string;
  size?: 'hero' | 'default';
  className?: string;
};

export function PnlCell({ value, display, size = 'default', className }: PnlCellProps) {
  const tone =
    value > 0 ? 'text-signal-bull' : value < 0 ? 'text-signal-bear' : 'text-fg-muted';

  return (
    <span
      className={cn(
        size === 'hero' ? cn(CELL_HERO_CLASS, 'block w-full text-right') : CELL_PRIMARY_CLASS,
        tone,
        className,
      )}
    >
      {display}
    </span>
  );
}
