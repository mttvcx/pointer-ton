'use client';

import { cn } from '@/lib/utils/cn';
import { spotTickerIconSrc } from '@/lib/chains/chainAssets';

/**
 * Bottom-bar spot ticker marks — official chain artwork at tuned sizes.
 * SOL reads larger at equal px; BTC/ETH PNG+SVG already include their own circle.
 */
const TICKER_ICON_PX: Record<string, number> = {
  BTC: 16,
  ETH: 16,
  SOL: 13,
  TON: 14,
  BNB: 14,
  BASE: 14,
};

export function spotTickerIconSize(symbol: string): number {
  return TICKER_ICON_PX[symbol.trim().toUpperCase()] ?? 14;
}

export function SpotTickerIcon({
  symbol,
  className,
}: {
  symbol: string;
  className?: string;
}) {
  const sym = symbol.trim().toUpperCase();
  const src = spotTickerIconSrc(sym);
  const px = spotTickerIconSize(sym);

  if (!src) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center text-[8px] font-bold uppercase leading-none text-white/75',
          className,
        )}
        style={{ width: px, height: px }}
        aria-hidden
      >
        {sym.slice(0, 3)}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- small marks from /public/chains
    <img
      src={src}
      alt=""
      width={px}
      height={px}
      draggable={false}
      className={cn('inline-block shrink-0 object-contain object-center', className)}
      style={{ width: px, height: px, maxWidth: px, maxHeight: px }}
    />
  );
}
