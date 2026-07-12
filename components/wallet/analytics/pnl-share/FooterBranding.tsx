'use client';

import type { CSSProperties } from 'react';
import { MetallicText } from '@/components/wallet/analytics/pnl-share/MetallicText';
import { PointerBirdMark } from '@/components/wallet/analytics/pnl-share/PointerLogoLockup';
import type { OverlayAccent, ShareBackgroundPresetId } from '@/lib/share/types';
import { PNL_SHARE_POS } from '@/lib/share/pnlShareLayout';
import { shareCardTheme } from '@/lib/share/shareCardTheme';
import { cn } from '@/lib/utils/cn';

function GlobeMark({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.6 3 4 6 4 9s-1.4 6-4 9c-2.6-3-4-6-4-9s1.4-6 4-9z" />
    </svg>
  );
}

export function FooterBranding({
  username,
  theme = 'midnight',
  accent = 'teal',
  className,
  style,
}: {
  username: string;
  theme?: ShareBackgroundPresetId;
  accent?: OverlayAccent;
  className?: string;
  style?: CSSProperties;
}) {
  const pos = PNL_SHARE_POS;
  const cardTheme = shareCardTheme(theme);

  return (
    <div className={cn('flex max-w-[880px] flex-col gap-4 overflow-visible', className)} style={style}>
      <MetallicText
        variant="stat"
        theme={theme}
        accent={accent}
        className="font-serif font-black italic tracking-tight"
        style={{ fontSize: pos.footerHandle.fontSize, lineHeight: 1.15 }}
      >
        {username}
      </MetallicText>
      <span className="inline-flex items-center gap-3">
        <GlobeMark className="h-9 w-9 shrink-0 opacity-90" style={{ color: cardTheme.accent }} />
        <span
          className="font-sans font-semibold tracking-wide"
          style={{ fontSize: pos.footerDomain.fontSize, lineHeight: 1.2, color: cardTheme.accent }}
        >
          pointer.am
        </span>
      </span>
      <p
        className="max-w-[780px] font-sans font-medium leading-snug text-white/78"
        style={{ fontSize: pos.footerPromo.fontSize, lineHeight: 1.28 }}
      >
        Save 50% off fees, forever.
      </p>
    </div>
  );
}
