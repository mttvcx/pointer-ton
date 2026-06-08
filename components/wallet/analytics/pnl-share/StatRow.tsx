'use client';

import { MetallicText } from '@/components/wallet/analytics/pnl-share/MetallicText';
import type { ShareBackgroundPresetId } from '@/lib/share/types';
import { cn } from '@/lib/utils/cn';

export function StatRow({
  label,
  value,
  theme = 'midnight',
  className,
}: {
  label: string;
  value: string;
  theme?: ShareBackgroundPresetId;
  className?: string;
}) {
  return (
    <div className={cn('flex items-baseline justify-between gap-6', className)}>
      <MetallicText
        variant="body"
        theme={theme}
        className="shrink-0 text-[13px] font-bold uppercase tracking-[0.22em] text-white/45"
        style={{ color: 'rgba(255,255,255,0.42)', WebkitTextFillColor: 'rgba(255,255,255,0.42)', backgroundImage: 'none' }}
      >
        {label}
      </MetallicText>
      <MetallicText
        variant="stat"
        theme={theme}
        className="font-mono text-[22px] font-extrabold tabular-nums leading-none"
      >
        {value}
      </MetallicText>
    </div>
  );
}
