'use client';

import { ChromePanel } from '@/components/wallet/analytics/pnl-share/ChromePanel';
import { MetallicText } from '@/components/wallet/analytics/pnl-share/MetallicText';
import type { OverlayAccent, PnlShareCalendarDay, ShareBackgroundPresetId } from '@/lib/share/types';
import { ACCENT_GLOW_RGBA, ACCENT_SOFT_RGBA } from '@/lib/share/accentTokens';
import { shareCardTheme } from '@/lib/share/shareCardTheme';
import { cn } from '@/lib/utils/cn';

export function CalendarPanel({
  days,
  monthLabel,
  theme = 'midnight',
  accent = 'teal',
  className,
}: {
  days: PnlShareCalendarDay[];
  monthLabel?: string | null;
  theme?: ShareBackgroundPresetId;
  accent?: OverlayAccent;
  className?: string;
}) {
  if (days.length === 0) return null;

  const cardTheme = shareCardTheme(theme);
  const accentGlow = ACCENT_GLOW_RGBA[accent];
  const accentSoft = ACCENT_SOFT_RGBA[accent];

  return (
    <ChromePanel
      intensity="medium"
      rounded="lg"
      accent={accent}
      theme={theme}
      className={cn('flex flex-col p-6', className)}
    >
      <div
        className="flex items-center justify-between gap-3 border-b pb-4"
        style={{ borderColor: cardTheme.heroBoxBorder }}
      >
        <MetallicText variant="title" theme={theme} accent={accent} className="text-[22px] font-bold tracking-wide">
          PNL Calendar
        </MetallicText>
        {monthLabel ? (
          <span className="font-mono text-[15px] tabular-nums" style={{ color: cardTheme.accentMuted }}>
            {monthLabel}
          </span>
        ) : null}
      </div>

      <div className="mt-5 grid grid-cols-7 gap-2.5">
        {days.map((d, i) => (
          <div
            key={`${d.day}-${i}`}
            className={cn(
              'flex flex-col items-center rounded-sm border px-1.5 py-2.5',
              d.positive ? 'bg-white/[0.07]' : 'border-white/14 bg-black/35',
            )}
            style={
              d.positive
                ? {
                    borderColor: cardTheme.heroBoxBorder,
                    boxShadow: `0 0 16px ${accentSoft}, 0 0 20px ${cardTheme.heroBoxGlow}, inset 0 0 12px ${accentGlow}`,
                  }
                : undefined
            }
          >
            <span className="text-[11px] font-bold uppercase tracking-wider text-white/40">{d.label}</span>
            <span className="mt-0.5 font-mono text-[14px] font-semibold tabular-nums text-white/60">{d.day}</span>
            <MetallicText
              variant="stat"
              theme={theme}
              accent={accent}
              positive={d.positive}
              className="mt-2 font-mono text-[13px] font-bold tabular-nums leading-tight"
            >
              {d.value}
            </MetallicText>
          </div>
        ))}
      </div>
    </ChromePanel>
  );
}
