'use client';

import type { ResolvedWalletIdentity } from '@/lib/identity/types';
import { IdentityAvatar } from '@/components/identity/IdentityAvatar';
import { IdentityBadge } from '@/components/identity/IdentityBadge';
import { IdentityName } from '@/components/identity/IdentityName';
import { cn } from '@/lib/utils/cn';

export function IdentityMiniCard({
  identity,
  className,
}: {
  identity: ResolvedWalletIdentity;
  className?: string;
}) {
  if (!identity.identityId) return null;
  return (
    <div
      className={cn(
        'flex items-center gap-2 rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1.5',
        className,
      )}
    >
      <IdentityAvatar src={identity.avatarUrl} name={identity.displayName} size={28} />
      <div className="min-w-0 flex-1">
        <IdentityName name={identity.displayName} manualOverride={identity.manualOverride} />
        <p className="truncate text-[10px] tabular-nums text-white/45">{identity.shortAddress}</p>
      </div>
      <div className="flex shrink-0 flex-wrap justify-end gap-0.5">
        {identity.badges.slice(0, 2).map((b) => (
          <IdentityBadge key={b} kind={b} />
        ))}
      </div>
    </div>
  );
}
