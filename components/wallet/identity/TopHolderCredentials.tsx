'use client';

import Link from 'next/link';
import { Crown, Medal, Trophy } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  formatTopHolderLabel,
  sortTopHolderCredentials,
  type TopHolderCredential,
  type TopHolderTier,
} from '@/lib/walletIdentity/topHolder';

/** Tier tint — literal class strings so Tailwind JIT keeps them. */
const TIER_PILL: Record<TopHolderTier, string> = {
  top10: 'border-amber-400/30 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20 hover:border-amber-400/50',
  top50: 'border-accent-primary/30 bg-accent-primary/10 text-accent-primary hover:bg-accent-primary/20 hover:border-accent-primary/50',
  top100: 'border-border-subtle bg-bg-sunken text-fg-secondary hover:bg-bg-hover hover:text-fg-primary',
};

function TierIcon({ tier, className }: { tier: TopHolderTier; className?: string }) {
  if (tier === 'top10') return <Crown className={className} strokeWidth={2.25} aria-hidden />;
  if (tier === 'top50') return <Medal className={className} strokeWidth={2.25} aria-hidden />;
  return <Trophy className={className} strokeWidth={2} aria-hidden />;
}

/** Grid of clickable credential pills — each links to the token page. */
export function TopHolderPills({
  credentials,
  max = 8,
  className,
}: {
  credentials: TopHolderCredential[];
  max?: number;
  className?: string;
}) {
  const sorted = sortTopHolderCredentials(credentials);
  if (sorted.length === 0) return null;
  const shown = sorted.slice(0, max);
  const overflow = sorted.length - shown.length;

  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {shown.map((c) => (
        <Link
          key={`${c.mint}-${c.rank}`}
          href={`/token/${c.mint}`}
          prefetch={false}
          title={`Rank #${c.rank} holder of ${c.symbol.replace(/^\$/, '').toUpperCase()}`}
          className={cn(
            'inline-flex items-center gap-1 rounded-sm border px-1.5 py-1 text-[10px] font-medium leading-none transition',
            TIER_PILL[c.tier],
          )}
        >
          <TierIcon tier={c.tier} className="h-3 w-3" />
          {formatTopHolderLabel(c)}
        </Link>
      ))}
      {overflow > 0 ? (
        <span className="inline-flex items-center rounded-sm border border-border-subtle bg-bg-sunken px-1.5 py-1 text-[10px] font-medium leading-none text-fg-muted">
          +{overflow}
        </span>
      ) : null}
    </div>
  );
}

/**
 * Compact inline badge for feed rows — "🏆 $FWOG, $CHILLGUY +3".
 * Tinted by the best tier the wallet holds. Non-interactive (row owns the click).
 */
export function TopHolderInlineBadge({
  credentials,
  maxNames = 2,
  className,
}: {
  credentials: TopHolderCredential[];
  maxNames?: number;
  className?: string;
}) {
  const sorted = sortTopHolderCredentials(credentials);
  if (sorted.length === 0) return null;
  const best = sorted[0]!.tier;
  const names = sorted
    .slice(0, maxNames)
    .map((c) => `$${c.symbol.replace(/^\$/, '').toUpperCase()}`)
    .join(', ');
  const extra = sorted.length - Math.min(maxNames, sorted.length);

  return (
    <span
      title={sorted.map((c) => formatTopHolderLabel(c)).join(' · ')}
      className={cn(
        'inline-flex max-w-full items-center gap-1 truncate rounded-sm border px-1 py-px text-[9px] font-semibold leading-none',
        TIER_PILL[best],
        className,
      )}
    >
      <TierIcon tier={best} className="h-2.5 w-2.5 shrink-0" />
      <span className="truncate">{names}{extra > 0 ? ` +${extra}` : ''}</span>
    </span>
  );
}
