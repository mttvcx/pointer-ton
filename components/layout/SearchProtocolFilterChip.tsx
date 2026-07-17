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
        'focus-ring inline-flex h-9 shrink-0 items-center gap-2 rounded-lg border px-3.5 text-[13px] font-semibold transition-colors',
        active ? searchModalFilterChipActiveClass : searchModalFilterChipIdleClass,
      )}
    >
      {protocolLogo ? (
        <ProtocolBrandIcon protocolId={protocolLogo} dotClassName="h-5 w-5" />
      ) : MetaIcon ? (
        <span
          className={cn(
            'flex h-5 w-5 shrink-0 items-center justify-center rounded-md border border-border-subtle bg-bg-hover',
            active && 'border-[rgb(var(--signal-bull-rgb)/0.5)] bg-[rgb(var(--signal-bull-rgb)/0.12)]',
          )}
        >
          <MetaIcon className="h-3.5 w-3.5 text-fg-muted" strokeWidth={2.25} aria-hidden />
        </span>
      ) : null}
      {label}
    </button>
  );
}
