'use client';

import { cn } from '@/lib/utils/cn';
import {
  CELL_PRIMARY_CLASS,
  CELL_SECONDARY_CLASS,
  CELL_TERTIARY_CLASS,
} from './deskTokens';

type Tone = 'buy' | 'sell' | 'neutral';

export type StackedNumericCellProps = {
  primary: string;
  secondary?: string | null;
  tertiary?: string | null;
  tone?: Tone;
  align?: 'left' | 'right';
  className?: string;
};

const toneToClass: Record<Tone, string> = {
  buy: 'text-signal-bull',
  sell: 'text-signal-bear',
  neutral: 'text-fg-primary',
};

export function StackedNumericCell({
  primary,
  secondary,
  tertiary,
  tone = 'neutral',
  align = 'right',
  className,
}: StackedNumericCellProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-[1px]',
        align === 'right' ? 'items-end' : 'items-start',
        className,
      )}
    >
      <span className={cn(CELL_PRIMARY_CLASS, toneToClass[tone])}>{primary}</span>
      {secondary ? <span className={CELL_SECONDARY_CLASS}>{secondary}</span> : null}
      {tertiary ? <span className={CELL_TERTIARY_CLASS}>{tertiary}</span> : null}
    </div>
  );
}
