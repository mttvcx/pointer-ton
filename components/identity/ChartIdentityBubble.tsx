'use client';

import type { TradeIdentityEvent } from '@/lib/identity/types';
import { IdentityAvatar } from '@/components/identity/IdentityAvatar';
import { cn } from '@/lib/utils/cn';

/**
 * Chart overlay marker for known-wallet trades.
 * Wire into lightweight-charts custom primitives when overlay support lands.
 */
export function ChartIdentityBubble({
  event,
  size = 22,
  className,
}: {
  event: TradeIdentityEvent;
  size?: number;
  className?: string;
}) {
  const ring =
    event.side === 'buy'
      ? 'ring-2 ring-emerald-400/90 ring-offset-1 ring-offset-black/80'
      : 'ring-2 ring-rose-400/90 ring-offset-1 ring-offset-black/80';
  return (
    <span
      className={cn('inline-flex rounded-full', ring, className)}
      title={`${event.displayName ?? event.walletAddress} · ${event.side}`}
    >
      <IdentityAvatar
        src={event.avatarUrl}
        name={event.displayName}
        size={size}
        ringClassName={ring}
      />
    </span>
  );
}
