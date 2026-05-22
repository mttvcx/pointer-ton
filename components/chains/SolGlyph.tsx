'use client';

import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';
import { cn } from '@/lib/utils/cn';

/** Official Solana mark — identical asset + sizing to {@link ChainSelectDropdown}. */
export function SolGlyph({
  className,
  size = 16,
}: {
  className?: string;
  /** Pixel width & height */
  size?: number;
}) {
  const px = Math.max(14, size);
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={CHAIN_ICON_PNG.sol}
      alt=""
      width={px}
      height={px}
      className={cn('shrink-0 object-contain', className)}
      draggable={false}
    />
  );
}
