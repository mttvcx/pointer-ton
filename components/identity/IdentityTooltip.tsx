'use client';

import type { ResolvedWalletIdentity } from '@/lib/identity/types';
import { IdentityAvatar } from '@/components/identity/IdentityAvatar';
import { IdentityBadge } from '@/components/identity/IdentityBadge';
import { formatCompactUsd } from '@/lib/utils/formatters';
import { cn } from '@/lib/utils/cn';

export function IdentityTooltip({
  identity,
  className,
}: {
  identity: ResolvedWalletIdentity;
  className?: string;
}) {
  const s = identity.stats30d;
  return (
    <div className={cn('space-y-2 text-[11px]', className)}>
      <div className="flex items-center gap-2">
        <IdentityAvatar src={identity.avatarUrl} name={identity.displayName} size={32} />
        <div className="min-w-0">
          <p className="font-semibold text-white">{identity.displayName}</p>
          <p className="tabular-nums text-white/50">{identity.shortAddress}</p>
          <p className="text-white/40">{identity.chain.toUpperCase()}</p>
        </div>
      </div>
      {identity.manualOverride ? (
        <p className="text-accent-primary/90">Your label overrides imported identity.</p>
      ) : null}
      <p className="text-white/55">{identity.sourceLabel}</p>
      {identity.badges.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {identity.badges.slice(0, 6).map((b) => (
            <IdentityBadge key={b} kind={b} />
          ))}
        </div>
      ) : null}
      {s ? (
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 tabular-nums text-white/70">
          {s.pnlUsd != null ? <span>30D PnL {formatCompactUsd(s.pnlUsd)}</span> : null}
          {s.winRate != null ? <span>Win {Math.round(s.winRate * 100)}%</span> : null}
          {s.txCount != null ? <span>TX {s.txCount}</span> : null}
          {s.volumeUsd != null ? <span>Vol {formatCompactUsd(s.volumeUsd)}</span> : null}
        </div>
      ) : null}
    </div>
  );
}
