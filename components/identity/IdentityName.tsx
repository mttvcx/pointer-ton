'use client';

import { truncateDisplayName } from '@/lib/identity/normalize';
import { cn } from '@/lib/utils/cn';

export function IdentityName({
  name,
  manualOverride,
  max = 22,
  className,
}: {
  name: string;
  manualOverride?: boolean;
  max?: number;
  className?: string;
}) {
  const shown = truncateDisplayName(name, max);
  return (
    <span
      className={cn(
        'truncate font-semibold',
        manualOverride ? 'text-accent-primary' : 'text-fg-primary',
        className,
      )}
      title={name.length > max ? name : undefined}
    >
      {shown}
    </span>
  );
}
