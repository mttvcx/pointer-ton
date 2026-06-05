'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';

export function DepositAssetIcon({
  src,
  label,
  size = 'md',
  className,
}: {
  src: string;
  label: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const px = size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-6 w-6' : 'h-4 w-4';

  if (failed) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full bg-[#2d3343] text-[8px] font-bold uppercase text-white/80 ring-1 ring-white/10',
          px,
          className,
        )}
        aria-hidden
      >
        {label.slice(0, 1)}
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/[0.06] ring-1 ring-white/10',
        px,
        className,
      )}
      aria-hidden
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt=""
        draggable={false}
        decoding="async"
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
      />
    </span>
  );
}
