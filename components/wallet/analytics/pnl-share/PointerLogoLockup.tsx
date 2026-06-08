'use client';

import type { CSSProperties } from 'react';
import { MetallicText } from '@/components/wallet/analytics/pnl-share/MetallicText';
import type { OverlayAccent, ShareBackgroundPresetId } from '@/lib/share/types';
import { PNL_SHARE_POS } from '@/lib/share/pnlShareLayout';
import { cn } from '@/lib/utils/cn';

/** Top-left swallow mark only — large bird, no wordmark. */
export function PointerBirdMark({
  className,
  style,
}: {
  className?: string;
  style?: CSSProperties;
}) {
  const size = PNL_SHARE_POS.logo.birdSize;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/branding/pointer-bird.png"
      alt=""
      width={size}
      height={size}
      decoding="async"
      className={cn(
        'shrink-0 object-contain drop-shadow-[0_0_18px_rgba(255,255,255,0.42)]',
        className,
      )}
      style={{ width: size, height: size, ...style }}
    />
  );
}

/** Top-right wordmark — metallic chrome "pointer." */
export function PointerWordmark({
  theme = 'midnight',
  accent = 'teal',
  className,
  style,
}: {
  theme?: ShareBackgroundPresetId;
  accent?: OverlayAccent;
  className?: string;
  style?: CSSProperties;
}) {
  const pos = PNL_SHARE_POS.wordmark;
  return (
    <MetallicText
      variant="wordmark"
      theme={theme}
      accent={accent}
      className={cn('block whitespace-nowrap text-right font-semibold leading-none tracking-tight', className)}
      style={{ fontSize: pos.fontSize, ...style }}
    >
      pointer.
    </MetallicText>
  );
}
