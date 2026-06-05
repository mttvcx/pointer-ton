'use client';

import { ProtocolBrandIcon } from '@/components/tokens/ProtocolBrandIcon';
import type { ProtocolBrandId } from '@/lib/tokens/protocolBrand';
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
  protocolLogo?: ProtocolBrandId;
  MetaIcon?: ComponentType<{ className?: string; strokeWidth?: number }>;
};

export function SearchProtocolFilterChip({
  label,
  active,
  onClick,
  protocolLogo,
  MetaIcon,
}: SearchProtocolFilterChipProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title="Filters search results only"
      className={cn(
        'focus-ring inline-flex h-8 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-medium transition-colors',
        active ? searchModalFilterChipActiveClass : searchModalFilterChipIdleClass,
      )}
    >
      {protocolLogo ? (
        <ProtocolBrandIcon protocolId={protocolLogo} dotClassName="h-[18px] w-[18px]" />
      ) : MetaIcon ? (
        <span
          className={cn(
            'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border border-border-subtle bg-bg-hover',
            active && 'border-border-default bg-bg-raised',
          )}
        >
          <MetaIcon className="h-3 w-3 text-fg-muted" strokeWidth={2.25} aria-hidden />
        </span>
      ) : null}
      {label}
    </button>
  );
}
