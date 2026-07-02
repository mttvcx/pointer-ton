'use client';

import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import type { PointerEvent as ReactPointerEvent } from 'react';

type CloseButtonSize = 'sm' | 'md' | 'lg';

const SIZE: Record<CloseButtonSize, { box: string; icon: string }> = {
  sm: { box: 'h-6 w-6', icon: 'h-3.5 w-3.5' },
  md: { box: 'h-7 w-7', icon: 'h-4 w-4' },
  lg: { box: 'h-8 w-8', icon: 'h-[18px] w-[18px]' },
};

/**
 * Universal close button — the rotate-on-hover + red-tint animation from the X
 * Monitor, so every "close" X across Pointer feels the same. Drop-in for any
 * dismiss control: modals, docks, panels, toasts, chips.
 */
export function CloseButton({
  onClick,
  onPointerDown,
  className,
  label = 'Close',
  size = 'md',
  title,
}: {
  onClick?: () => void;
  onPointerDown?: (e: ReactPointerEvent<HTMLButtonElement>) => void;
  className?: string;
  label?: string;
  size?: CloseButtonSize;
  title?: string;
}) {
  const sz = SIZE[size];
  return (
    <button
      type="button"
      aria-label={label}
      title={title ?? label}
      onClick={onClick}
      onPointerDown={onPointerDown}
      className={cn(
        'btn-press group/close relative flex shrink-0 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-signal-bear/15 hover:text-signal-bear',
        sz.box,
        className,
      )}
    >
      <X
        className={cn('pointer-events-none transition-transform group-hover/close:rotate-90', sz.icon)}
        strokeWidth={2.25}
        aria-hidden
      />
    </button>
  );
}
