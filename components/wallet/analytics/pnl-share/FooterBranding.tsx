'use client';

import type { CSSProperties } from 'react';
import { MetallicText } from '@/components/wallet/analytics/pnl-share/MetallicText';
import type { ShareBackgroundPresetId } from '@/lib/share/types';
import { cn } from '@/lib/utils/cn';

function GlobeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.6 3 4 6 4 9s-1.4 6-4 9c-2.6-3-4-6-4-9s1.4-6 4-9z" />
    </svg>
  );
}

export function FooterBranding({
  username,
  theme = 'midnight',
  showCashbackLine = true,
  className,
  style,
}: {
  username: string;
  theme?: ShareBackgroundPresetId;
  showCashbackLine?: boolean;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div className={cn('flex flex-col gap-2', className)} style={style}>
      <MetallicText variant="stat" theme={theme} className="text-[26px] font-bold tracking-tight">
        {username}
      </MetallicText>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-white/55">
        <span className="inline-flex items-center gap-1.5">
          <GlobeMark className="h-3.5 w-3.5 opacity-80" />
          <span className="text-[13px] font-semibold tracking-wide text-white/70">pointer.trade</span>
        </span>
        {showCashbackLine ? (
          <span className="text-[12px] font-medium text-white/45">
            Save 50% off fees, the highest in the game.
          </span>
        ) : null}
      </div>
    </div>
  );
}
