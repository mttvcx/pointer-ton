'use client';

import type { WalletIntelBadgeKind } from '@/lib/walletIdentity/types';
import { walletIntelBadgeDisplay } from '@/lib/walletIdentity/walletIntelBadgeDisplay';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils/cn';

const BADGE_STYLES: Record<WalletIntelBadgeKind, string> = {
  kol: 'bg-signal-info/15 text-signal-info',
  smart_money: 'bg-signal-bull/15 text-signal-bull',
  tracked: 'bg-fg-muted/15 text-fg-secondary',
  renamed: 'bg-fg-muted/15 text-fg-secondary',
  top_trader: 'bg-accent-primary/15 text-accent-primary',
  insider: 'bg-signal-bear/15 text-signal-bear',
  dev: 'bg-fg-muted/15 text-fg-secondary',
  fresh: 'bg-signal-bull/15 text-signal-bull',
  whale: 'bg-signal-info/15 text-signal-info',
  high_win_rate: 'bg-signal-bull/15 text-signal-bull',
  sniper: 'bg-signal-bear/15 text-signal-bear',
};

export function WalletIdentityBadges({
  kinds,
  className,
  max = 3,
  variant = 'icon',
}: {
  kinds: WalletIntelBadgeKind[];
  className?: string;
  /** Cap inline noise on table rows. */
  max?: number;
  /** Desk rows: symbolic icons; dossier header: text chips. */
  variant?: 'icon' | 'text';
}) {
  const show = kinds.slice(0, max);
  if (show.length === 0) return null;

  if (variant === 'text') {
    return (
      <span className={cn('inline-flex flex-wrap items-center gap-1', className)}>
        {show.map((k) => {
          const { textLabel } = walletIntelBadgeDisplay(k);
          return (
            <span
              key={k}
              className={cn(
                'inline-flex items-center rounded px-1 py-px text-[9px] font-normal uppercase leading-none tracking-wide',
                BADGE_STYLES[k],
              )}
              title={walletIntelBadgeDisplay(k).tooltip}
            >
              {textLabel}
            </span>
          );
        })}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex shrink-0 items-center gap-0.5 overflow-hidden', className)}>
      {show.map((k) => {
        const { Icon, iconClass, tooltip } = walletIntelBadgeDisplay(k);
        return (
          <Tooltip key={k}>
            <TooltipTrigger asChild>
              <span className="inline-flex shrink-0 items-center justify-center">
                <Icon className={cn('h-3 w-3 shrink-0', iconClass)} strokeWidth={2.25} aria-hidden />
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-[10px]">
              {tooltip}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </span>
  );
}
