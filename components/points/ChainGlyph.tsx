'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils/cn';
import { POINTS_ECOSYSTEM_CHAIN_ICON } from '@/lib/chains/chainAssets';
import type { EcosystemCampaignId } from '@/components/points/pointsUiConfig';

/**
 * Same artwork as the header {@link ChainSelectDropdown} (`lib/chains/chainAssets` → `/public/chains/*`).
 */
export function ChainGlyph({
  chain,
  className,
  title,
}: {
  chain: EcosystemCampaignId;
  className?: string;
  title?: string;
}) {
  const src = POINTS_ECOSYSTEM_CHAIN_ICON[chain];
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className={cn('flex shrink-0 items-center justify-center rounded-lg bg-bg-hover ring-1 ring-white/10', className)}
        title={title}
      >
        <span className="text-[10px] font-semibold text-fg-muted">?</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={title ?? ''}
      width={32}
      height={32}
      className={cn('h-8 w-8 shrink-0 object-contain', className)}
      draggable={false}
      onError={() => setFailed(true)}
    />
  );
}
