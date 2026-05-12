'use client';

import type { WalletIntelBadgeKind } from '@/lib/walletIdentity/types';
import { cn } from '@/lib/utils/cn';

/**
 * Trojan-style table badges:
 *   h-4, text-[10px], px-1.5 py-0, no border, ~10% accent-tinted bg, uppercase + tracking-wide.
 * They are designed to sit inline next to a wallet address — never on their own visual line.
 */
const BADGE_STYLES: Record<WalletIntelBadgeKind, string> = {
  kol: 'bg-signal-info/15 text-signal-info',
  smart_money: 'bg-signal-bull/15 text-signal-bull',
  tracked: 'bg-fg-muted/15 text-fg-secondary',
  renamed: 'bg-fg-muted/15 text-fg-secondary',
  top_trader: 'bg-accent-primary/15 text-accent-primary',
  insider: 'bg-signal-bear/15 text-signal-bear',
  dev: 'bg-fg-muted/15 text-fg-secondary',
  fresh: 'bg-signal-warn/15 text-signal-warn',
  whale: 'bg-signal-info/15 text-signal-info',
  high_win_rate: 'bg-signal-bull/15 text-signal-bull',
  sniper: 'bg-signal-bear/15 text-signal-bear',
};

function badgeLabel(k: WalletIntelBadgeKind): string {
  switch (k) {
    case 'kol':
      return 'KOL';
    case 'smart_money':
      return 'SMART';
    case 'high_win_rate':
      return 'WIN%';
    case 'top_trader':
      return 'TOP';
    case 'tracked':
      return 'TRACKED';
    case 'renamed':
      return 'RENAMED';
    case 'insider':
      return 'INSIDER';
    case 'dev':
      return 'DEV';
    case 'fresh':
      return 'FRESH';
    case 'whale':
      return 'WHALE';
    case 'sniper':
      return 'SNIPER';
    default:
      return String(k).toUpperCase();
  }
}

export function WalletIdentityBadges({
  kinds,
  className,
  max = 3,
}: {
  kinds: WalletIntelBadgeKind[];
  className?: string;
  /** Cap inline noise on table rows. */
  max?: number;
}) {
  const show = kinds.slice(0, max);
  if (show.length === 0) return null;
  return (
    <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
      {show.map((k) => (
        <span
          key={k}
          className={cn(
            'inline-flex h-4 items-center rounded px-1.5 text-[10px] font-medium uppercase leading-none tracking-wide',
            BADGE_STYLES[k],
          )}
          title={badgeLabel(k)}
        >
          {badgeLabel(k)}
        </span>
      ))}
    </span>
  );
}
