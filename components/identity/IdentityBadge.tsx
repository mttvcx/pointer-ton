'use client';

import { IDENTITY_BADGE_LABEL, IDENTITY_BADGE_TONE } from '@/lib/identity/badges';
import type { IdentityBadgeKind } from '@/lib/identity/types';
import { cn } from '@/lib/utils/cn';

export function IdentityBadge({
  kind,
  className,
  title,
}: {
  kind: IdentityBadgeKind;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title ?? kind}
      className={cn(
        'inline-flex shrink-0 items-center rounded border px-1 py-px text-[9px] font-semibold uppercase tracking-wide',
        IDENTITY_BADGE_TONE[kind] ?? 'border-white/15 bg-white/5 text-white/60',
        className,
      )}
    >
      {IDENTITY_BADGE_LABEL[kind] ?? kind}
    </span>
  );
}
