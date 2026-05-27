'use client';

import { cn } from '@/lib/utils/cn';

/** Official Pointer swallow mark — same asset as the app topbar (`/branding/pointer-bird.png`). */
export function PointerBirdMark({
  className,
  size = 20,
}: {
  className?: string;
  /** Pixel width & height */
  size?: number;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/branding/pointer-bird.png"
      alt=""
      width={size}
      height={size}
      className={cn('pointer-events-none shrink-0 select-none object-contain', className)}
      draggable={false}
    />
  );
}
