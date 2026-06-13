'use client';

import type { PredictionMarket } from '@/lib/predictions/marketsDemo';
import { resolvePredictionMarketIconUrl } from '@/lib/predictions/marketIcons';
import { cn } from '@/lib/utils/cn';

export function PredictionMarketIcon({
  market,
  size = 'md',
  className,
}: {
  market: PredictionMarket;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  const iconUrl = resolvePredictionMarketIconUrl(market);
  const box =
    size === 'sm' ? 'h-8 w-8 text-base' : size === 'lg' ? 'h-11 w-11 text-2xl' : 'h-9 w-9 text-lg';

  return (
    <div
      className={cn(
        'flex shrink-0 items-center justify-center overflow-hidden rounded-md bg-bg-hover/80 ring-1 ring-border-subtle/60',
        box,
        className,
      )}
    >
      {iconUrl ? (
        // eslint-disable-next-line @next/next/no-img-element -- external CDN logos
        <img src={iconUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden>{market.emoji}</span>
      )}
    </div>
  );
}
