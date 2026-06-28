'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Hyperliquid brand lockup. Uses the OFFICIAL logo asset — drop the real file at
 * `public/branding/hyperliquid.svg` (Hyperliquid brand kit). We deliberately do
 * NOT hand-draw a glyph: if the asset is missing the mark hides and only the
 * wordmark text shows, so we never ship an invented logo.
 */
export function HyperliquidWordmark({
  className,
  size = 'md',
}: {
  className?: string;
  size?: 'sm' | 'md';
}) {
  const [markOk, setMarkOk] = useState(true);
  const icon = size === 'sm' ? 'h-4 w-4' : 'h-5 w-5';
  const text = size === 'sm' ? 'text-[11px]' : 'text-[12px]';

  return (
    <span className={cn('inline-flex items-center gap-1.5', className)} aria-label="Hyperliquid">
      {markOk ? (
        // eslint-disable-next-line @next/next/no-img-element -- tiny brand mark, no optimization needed
        <img
          src="/branding/hyperliquid.png"
          alt=""
          aria-hidden
          className={cn('shrink-0 rounded-[3px] object-contain', icon)}
          onError={() => setMarkOk(false)}
        />
      ) : null}
      <span className={cn('font-semibold tracking-tight text-[#97FCE4]', text)}>Hyperliquid</span>
    </span>
  );
}

export function HyperliquidPoweredBy({ className, subtle }: { className?: string; subtle?: boolean }) {
  return (
    <p
      className={cn(
        'flex flex-wrap items-center gap-1.5 text-[11px]',
        subtle ? 'text-fg-muted/80' : 'text-fg-secondary',
        className,
      )}
    >
      <span className="text-fg-muted">Powered by</span>
      <HyperliquidWordmark size="sm" />
    </p>
  );
}
