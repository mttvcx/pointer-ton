'use client';

import { MetallicText } from '@/components/wallet/analytics/pnl-share/MetallicText';
import type { ShareBackgroundPresetId } from '@/lib/share/types';
import { cn } from '@/lib/utils/cn';

const BIRD_PATH =
  'M64 376 C 132 308 196 250 264 196 C 230 248 214 286 214 318 C 268 286 322 268 384 256 C 332 280 290 312 248 358 C 304 332 358 320 416 320 C 348 348 286 384 224 432 C 198 404 168 388 132 384 C 108 380 86 380 64 376 Z';

export function PointerLogoLockup({
  theme = 'midnight',
  className,
  size = 'md',
}: {
  theme?: ShareBackgroundPresetId;
  className?: string;
  size?: 'sm' | 'md';
}) {
  const birdH = size === 'sm' ? 28 : 36;
  const textSize = size === 'sm' ? 22 : 28;

  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <svg
        viewBox="0 0 512 512"
        width={birdH}
        height={birdH}
        aria-hidden
        className="shrink-0 drop-shadow-[0_0_8px_rgba(255,255,255,0.35)]"
      >
        <defs>
          <linearGradient id="ptr-bird-fill" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="50%" stopColor="#d4d4d8" />
            <stop offset="100%" stopColor="#fafafa" />
          </linearGradient>
        </defs>
        <path d={BIRD_PATH} fill="url(#ptr-bird-fill)" />
      </svg>
      <MetallicText
        variant="title"
        theme={theme}
        className="font-semibold leading-none tracking-tight"
        style={{ fontSize: textSize }}
      >
        pointer.
      </MetallicText>
    </div>
  );
}
