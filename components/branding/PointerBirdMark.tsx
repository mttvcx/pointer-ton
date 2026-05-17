'use client';

import { cn } from '@/lib/utils/cn';

/** Inline Pointer bird — `/public/branding/logo-bird.svg` (brand mark, not chain glyphs). */
export function PointerBirdMark({
  className,
  size = 20,
}: {
  className?: string;
  /** Pixel width & height */
  size?: number;
}) {
  return (
    <img
      src="/branding/logo-bird.svg"
      alt=""
      width={size}
      height={size}
      className={cn('pointer-events-none shrink-0 select-none object-contain', className)}
      draggable={false}
    />
  );
}
