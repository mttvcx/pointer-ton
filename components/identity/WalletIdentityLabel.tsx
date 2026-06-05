'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import type { AppChainId } from '@/lib/chains/appChain';
import { useWalletLabels } from '@/lib/hooks/useWalletLabels';
import { useTrackedWalletsLookup } from '@/lib/hooks/useTrackedWalletsLookup';
import { resolveWalletIdentity } from '@/lib/identity/identityService';
import { IdentityAvatar } from '@/components/identity/IdentityAvatar';
import { IdentityBadge } from '@/components/identity/IdentityBadge';
import { IdentityName } from '@/components/identity/IdentityName';
import { IdentityTooltip } from '@/components/identity/IdentityTooltip';
import { explorerAccountUrlForChain } from '@/lib/chains/explorer';
import { cn } from '@/lib/utils/cn';

export function WalletIdentityLabel({
  chain,
  address,
  href,
  showAddress = true,
  maxBadges = 2,
  avatarSize = 22,
  className,
  onClick,
}: {
  chain: AppChainId;
  address: string;
  href?: string;
  showAddress?: boolean;
  maxBadges?: number;
  avatarSize?: number;
  className?: string;
  onClick?: () => void;
}) {
  const { resolveLabel } = useWalletLabels();
  const { isTracked } = useTrackedWalletsLookup();
  const labelDisp = resolveLabel(address, 5);
  const userLabel =
    labelDisp?.labeled === true ? labelDisp.label : null;

  const identity = useMemo(
    () =>
      resolveWalletIdentity({
        chain,
        address,
        userLabel,
      }),
    [chain, address, userLabel],
  );

  const known = Boolean(identity.identityId);
  const body = (
    <span
      className={cn(
        'inline-flex min-w-0 max-w-full items-center gap-1.5',
        href || onClick ? 'cursor-pointer hover:opacity-90' : '',
        className,
      )}
      onClick={onClick}
      title={identity.displayName}
    >
      {known ? (
        <IdentityAvatar src={identity.avatarUrl} name={identity.displayName} size={avatarSize} />
      ) : null}
      <span className="flex min-w-0 flex-col leading-tight">
        {known ? (
          <IdentityName name={identity.displayName} manualOverride={identity.manualOverride} />
        ) : null}
        {showAddress ? (
          <span className="truncate tabular-nums text-[10px] text-white/45">
            {identity.shortAddress}
          </span>
        ) : null}
      </span>
      {identity.badges.slice(0, maxBadges).map((b) => (
        <IdentityBadge key={b} kind={b} />
      ))}
      {isTracked(address) ? (
        <span className="text-[9px] font-medium uppercase tracking-wide text-white/40">Tracked</span>
      ) : null}
    </span>
  );

  const tooltip = (
    <span className="group relative inline-flex min-w-0">
      {href ? (
        <Link href={href} className="min-w-0">
          {body}
        </Link>
      ) : (
        body
      )}
      <span
        className={cn(
          'pointer-events-none absolute bottom-full left-0 z-[200] mb-2 hidden w-[260px] rounded-md border border-border-subtle bg-bg-raised p-3 shadow-xl',
          'group-hover:pointer-events-auto group-hover:block',
        )}
        role="tooltip"
      >
        <IdentityTooltip identity={identity} />
        <a
          href={explorerAccountUrlForChain(address, chain)}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-[10px] text-accent-primary hover:underline"
        >
          View on explorer
        </a>
      </span>
    </span>
  );

  return tooltip;
}
