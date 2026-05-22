'use client';

import { protocolBrand, protocolLogoSrc, launchPadToProtocolId } from '@/lib/tokens/protocolBrand';
import { cn } from '@/lib/utils/cn';
import { useUIStore } from '@/store/ui';

export function LaunchpadBadge({ launchPad }: { launchPad: string | null }) {
  const activeChain = useUIStore((s) => s.activeChain);
  if (!launchPad) return null;

  const protocolId = launchPadToProtocolId(launchPad, activeChain) ?? launchPad;
  const brand = protocolBrand(protocolId);

  if (brand) {
    return (
      <span className="inline-flex shrink-0" title={brand.label}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={protocolLogoSrc(protocolId)}
          alt=""
          width={14}
          height={14}
          draggable={false}
          className={cn(
            'h-3.5 w-3.5 shrink-0 rounded-full object-cover opacity-90',
            protocolId === 'bonk' && 'bg-[#f7931a] p-0.5',
          )}
          aria-hidden
        />
      </span>
    );
  }

  let fallback = launchPad.replace(/[^a-z0-9]/gi, '').slice(0, 2).toUpperCase();
  if (fallback.length === 1) fallback = `${fallback}${fallback}`;
  if (fallback.length === 0) fallback = 'LP';

  return (
    <span
      className={cn(
        'inline-flex h-3.5 min-w-0 shrink-0 items-center tabular-nums text-[10px] font-semibold uppercase leading-none tracking-wide text-fg-muted opacity-50',
      )}
      title={launchPad}
    >
      {fallback.slice(0, 2)}
    </span>
  );
}
