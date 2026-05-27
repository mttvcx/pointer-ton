'use client';

import Image from 'next/image';
import { chainLogoSrc } from '@/lib/chains/chainAssets';
import { cn } from '@/lib/utils/cn';

/** Normalizes display strings like “Solana” → `solana` for {@link chainLogoSrc}. */
const CHAIN_SYNONYMS: Record<string, string> = {
  solana: 'solana',
  sol: 'sol',
  ton: 'ton',
  'the open network': 'ton',
  base: 'base',
  ethereum: 'ethereum',
  eth: 'eth',
  bnb: 'bnb',
  hyperliquid: 'hyperliquid',
};

export function resolveChainSlug(raw: string): string | null {
  const k = raw.toLowerCase().trim();
  if (chainLogoSrc[k]) return k;
  const syn = CHAIN_SYNONYMS[k];
  if (syn && chainLogoSrc[syn]) return syn;
  return null;
}

export function hasChainLogo(raw: string): boolean {
  return resolveChainSlug(raw) !== null;
}

export interface ChainIconProps {
  chain: string;
  size?: number;
  className?: string;
}

export function ChainIcon({ chain, size = 14, className }: ChainIconProps) {
  const key = resolveChainSlug(chain);
  const src = key ? chainLogoSrc[key] : null;
  if (!src) return null;
  const title = chain;
  return (
    <span className={cn('inline-flex shrink-0', className)} title={title}>
      <Image src={src} alt="" width={size} height={size} className="block" unoptimized />
    </span>
  );
}
