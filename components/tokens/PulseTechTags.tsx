'use client';

import type { PulseTokenBundle } from '@/types/tokens';
import type { AppChainId } from '@/lib/chains/appChain';
import { resolvePulseTechTags } from '@/lib/tokens/pulseTechLabel';
import { cn } from '@/lib/utils/cn';

export function PulseTechTags({
  bundle,
  chain,
  className,
}: {
  bundle: PulseTokenBundle;
  chain: AppChainId;
  className?: string;
}) {
  const tags = resolvePulseTechTags(bundle, chain);
  if (tags.length === 0) return null;

  return (
    <span className={cn('flex max-w-full flex-wrap items-center justify-center gap-0.5', className)}>
      {tags.map((tag) => (
        <span
          key={tag.key}
          title={tag.title ?? tag.label}
          className={cn(
            'max-w-[4.5rem] truncate rounded px-1 py-px',
            'font-mono text-[8px] font-medium uppercase leading-none tracking-tight',
            tag.key === 'quote'
              ? 'bg-[#eab308]/15 text-[#facc15]/90 ring-1 ring-[#eab308]/25'
              : tag.key === 'launch'
                ? 'bg-accent-primary/10 text-accent-primary/90 ring-1 ring-accent-primary/20'
                : tag.key === 'src'
                  ? 'bg-white/[0.06] text-fg-muted/90 ring-1 ring-white/[0.06]'
                  : 'bg-white/[0.04] text-fg-muted/80',
          )}
        >
          {tag.label}
        </span>
      ))}
    </span>
  );
}
