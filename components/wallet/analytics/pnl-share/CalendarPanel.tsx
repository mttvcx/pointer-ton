'use client';

import { ChromePanel } from '@/components/wallet/analytics/pnl-share/ChromePanel';
import { MetallicText } from '@/components/wallet/analytics/pnl-share/MetallicText';
import type { PnlShareCalendarDay } from '@/lib/share/types';
import type { ShareBackgroundPresetId } from '@/lib/share/types';
import { cn } from '@/lib/utils/cn';

export function CalendarPanel({
  days,
  monthLabel,
  theme = 'midnight',
  className,
}: {
  days: PnlShareCalendarDay[];
  monthLabel?: string | null;
  theme?: ShareBackgroundPresetId;
  className?: string;
}) {
  if (days.length === 0) return null;

  return (
    <ChromePanel intensity="medium" rounded="lg" className={cn('flex flex-col p-5', className)}>
      <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3">
        <MetallicText variant="title" theme={theme} className="text-[18px] font-bold tracking-wide">
          PNL Calendar
        </MetallicText>
        {monthLabel ? (
          <span className="font-mono text-[13px] tabular-nums text-white/50">{monthLabel}</span>
        ) : null}
      </div>

      <div className="mt-4 grid grid-cols-7 gap-2">
        {days.map((d, i) => (
          <div
            key={`${d.day}-${i}`}
            className={cn(
              'flex flex-col items-center rounded-sm border px-1 py-2',
              d.positive
                ? 'border-white/25 bg-white/[0.06] shadow-[0_0_12px_rgba(255,255,255,0.08)]'
                : 'border-white/12 bg-black/30',
            )}
          >
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/35">{d.label}</span>
            <span className="mt-0.5 font-mono text-[11px] font-semibold tabular-nums text-white/55">{d.day}</span>
            <MetallicText
              variant="stat"
              theme={theme}
              positive={d.positive}
              className="mt-1.5 font-mono text-[10px] font-bold tabular-nums leading-tight"
            >
              {d.value}
            </MetallicText>
          </div>
        ))}
      </div>
    </ChromePanel>
  );
}
