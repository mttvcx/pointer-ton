'use client';

import { useState, type CSSProperties } from 'react';
import type { AppChainId } from '@/lib/chains/appChain';
import { CHAIN_ICON_PNG } from '@/lib/chains/chainAssets';
import { protocolBrand, protocolLogoSrc } from '@/lib/tokens/protocolBrand';
import { cn } from '@/lib/utils/cn';

export function ProtocolBrandIcon({
  protocolId,
  className,
  dotClassName = 'h-3.5 w-3.5',
}: {
  protocolId: string;
  className?: string;
  dotClassName?: string;
}) {
  const brand = protocolBrand(protocolId);
  const [failed, setFailed] = useState(false);

  if (!brand || failed) {
    return (
      <span
        className={cn(
          'shrink-0 rounded-full bg-white/[0.06] ring-1 ring-white/[0.08]',
          dotClassName,
          className,
        )}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- local static protocol logos
    <img
      src={protocolLogoSrc(protocolId)}
      alt=""
      className={cn('shrink-0 rounded-full object-cover', dotClassName, className)}
      draggable={false}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
      aria-hidden
    />
  );
}

export function QuoteTokenIcon({
  kind,
  chain = 'sol',
  className,
  style,
}: {
  kind: 'native' | 'usdc' | 'usd1';
  /** Active chain — native quote icons follow SOL / BNB / TON / BASE artwork. */
  chain?: AppChainId;
  className?: string;
  style?: CSSProperties;
}) {
  const [failed, setFailed] = useState(false);
  const src =
    kind === 'native'
      ? CHAIN_ICON_PNG[chain]
      : `/logos/protocols/${kind === 'usdc' ? 'usdc.png' : 'usd1.png'}`;

  if (failed) {
    return (
      <span
        className={cn(
          'shrink-0 rounded-full bg-white/[0.06] ring-1 ring-white/[0.08]',
          'h-3.5 w-3.5',
          className,
        )}
        aria-hidden
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      className={cn(
        'shrink-0 rounded-full object-cover',
        'h-3.5 w-3.5 object-contain',
        className,
      )}
      style={style}
      draggable={false}
      onError={() => setFailed(true)}
      aria-hidden
    />
  );
}
