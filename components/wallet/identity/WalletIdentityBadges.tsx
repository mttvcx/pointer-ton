'use client';

import type { WalletIntelBadgeKind } from '@/lib/walletIdentity/types';
import { cn } from '@/lib/utils/cn';

/**
 * Trojan-style table badges:
 *   h-4, text-[10px], px-1.5 py-0, no border, ~10% accent-tinted bg, uppercase + tracking-wide.
 * They are designed to sit inline next to a wallet address — never on their own visual line.
 */
const BADGE_STYLES: Record<WalletIntelBadgeKind, string> = {
  kol: 'bg-fuchsia-500/10 text-fuchsia-200',
  smart_money: 'bg-cyan-500/10 text-cyan-200',
  tracked: 'bg-sky-500/10 text-sky-200',
  renamed: 'bg-amber-500/10 text-amber-200',
  top_trader: 'bg-violet-500/10 text-violet-200',
  insider: 'bg-rose-500/10 text-rose-200',
  dev: 'bg-amber-600/12 text-amber-200',
  fresh: 'bg-emerald-500/10 text-emerald-200',
  whale: 'bg-indigo-500/10 text-indigo-200',
  high_win_rate: 'bg-lime-500/10 text-lime-200',
  sniper: 'bg-orange-500/10 text-orange-200',
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
            'inline-flex h-4 items-center rounded-sm px-1.5 text-[10px] font-semibold uppercase leading-none tracking-wide',
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
