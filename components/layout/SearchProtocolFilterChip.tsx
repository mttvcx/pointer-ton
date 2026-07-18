'use client';

import { ProtocolBrandIcon } from '@/components/tokens/ProtocolBrandIcon';
import {
  searchModalFilterChipActiveClass,
  searchModalFilterChipIdleClass,
} from '@/lib/ui/searchModalChrome';
import { cn } from '@/lib/utils/cn';
import type { ComponentType } from 'react';

export type SearchProtocolFilterId =
  | 'pump'
  | 'bonk'
  | 'bags'
  | 'og_mode'
  | 'graduated'
  | 'dex_paid';

type SearchProtocolFilterChipProps = {
  label: string;
  active: boolean;
  onClick: () => void;
  /** Protocol brand id (e.g. 'pump.fun') — resolved to its real logo. */
  protocolLogo?: string;
  /** Direct logo path (for tokens not in the protocol registry, e.g. USDC). */
  imageSrc?: string;
  MetaIcon?: ComponentType<{ className?: string; strokeWidth?: number }>;
};

export function SearchProtocolFilterChip({
  label,
  active,
  onClick,
  protocolLogo,
  imageSrc,
  MetaIcon,
}: SearchProtocolFilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title="Filters search results only"
      className={cn(
        'focus-ring inline-flex h-7 shrink-0 items-center gap-1.5 rounded-md border px-2 text-[11px] font-semibold transition-colors',
        active ? searchModalFilterChipActiveClass : searchModalFilterChipIdleClass,
      )}
    >
      {imageSrc ? (
        // eslint-disable-next-line @next/next/no-img-element -- local static logo
        <img src={imageSrc} alt="" className="h-3.5 w-3.5 shrink-0 rounded-full object-contain" draggable={false} aria-hidden />
      ) : protocolLogo ? (
        <ProtocolBrandIcon protocolId={protocolLogo} dotClassName="h-3.5 w-3.5" />
      ) : MetaIcon ? (
        <span
          className={cn(
            'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-[3px] border border-border-subtle bg-bg-hover',
            active && 'border-[rgb(var(--signal-bull-rgb)/0.5)] bg-[rgb(var(--signal-bull-rgb)/0.12)]',
          )}
        >
          <MetaIcon className="h-2.5 w-2.5 text-fg-muted" strokeWidth={2.25} aria-hidden />
        </span>
      ) : null}
      {label}
    </button>
  );
}
