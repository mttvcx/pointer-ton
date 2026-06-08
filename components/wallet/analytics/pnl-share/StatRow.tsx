'use client';

import { MetallicText } from '@/components/wallet/analytics/pnl-share/MetallicText';
import type { OverlayAccent, ShareBackgroundPresetId } from '@/lib/share/types';
import { PNL_SHARE_POS } from '@/lib/share/pnlShareLayout';
import { shareCardTheme } from '@/lib/share/shareCardTheme';
import { cn } from '@/lib/utils/cn';

export function StatRow({
  label,
  value,
  theme = 'midnight',
  accent = 'teal',
  className,
}: {
  label: string;
  value: string;
  theme?: ShareBackgroundPresetId;
  accent?: OverlayAccent;
  className?: string;
}) {
  const pos = PNL_SHARE_POS.stats;
  const cardTheme = shareCardTheme(theme);

  return (
    <div
      className={cn('flex items-center justify-between gap-10 overflow-visible', className)}
      style={{ minHeight: pos.rowMinH }}
    >
      <span
        className="shrink-0 font-serif font-bold italic uppercase tracking-[0.28em]"
        style={{ fontSize: pos.labelSize, lineHeight: 1.2, color: `${cardTheme.accentMuted}cc` }}
      >
        {label}
      </span>
      <MetallicText
        variant="stat"
        theme={theme}
        accent={accent}
        className="shrink-0 font-serif font-black italic tabular-nums tracking-wide"
        style={{
          fontSize: pos.valueSize,
          lineHeight: 1.2,
          paddingTop: 4,
          paddingBottom: 4,
        }}
      >
        {value}
      </MetallicText>
    </div>
  );
}
