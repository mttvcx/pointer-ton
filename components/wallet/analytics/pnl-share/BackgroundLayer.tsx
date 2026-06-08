'use client';

import type { ShareBackgroundPresetId } from '@/lib/share/types';
import {
  THEME_BASE_GRADIENT,
  THEME_BLOOM_LAYERS,
  THEME_CURVE_STROKE,
  THEME_STREAK_PRIMARY,
} from '@/lib/share/shareCardTheme';
import { cn } from '@/lib/utils/cn';

export function BackgroundLayer({
  theme = 'midnight',
  hasCustomMedia = false,
  overlayOpacity = 0.48,
  className,
}: {
  theme?: ShareBackgroundPresetId;
  hasCustomMedia?: boolean;
  overlayOpacity?: number;
  className?: string;
}) {
  const dim = Math.min(0.82, 0.18 + overlayOpacity * 0.75);
  const presetDim = Math.min(0.55, overlayOpacity * 0.65);
  const curves = THEME_CURVE_STROKE[theme];

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      {!hasCustomMedia ? (
        <>
          <div className="absolute inset-0" style={{ background: THEME_BASE_GRADIENT[theme] }} />
          <div className="absolute inset-0 opacity-95" style={{ background: THEME_BLOOM_LAYERS[theme] }} />
          <div
            className="absolute -left-[10%] top-[6%] h-[58%] w-[72%] rotate-[-22deg] opacity-40"
            style={{ background: THEME_STREAK_PRIMARY[theme] }}
          />
          <div
            className="absolute -right-[5%] bottom-[4%] h-[48%] w-[58%] rotate-[16deg] opacity-32"
            style={{
              background:
                theme === 'glacier'
                  ? 'linear-gradient(75deg, transparent 0%, rgba(103,232,249,0.12) 42%, rgba(34,211,238,0.04) 50%, transparent 70%)'
                  : theme === 'onyx'
                    ? 'linear-gradient(75deg, transparent 0%, rgba(148,163,184,0.12) 42%, rgba(148,163,184,0.04) 50%, transparent 70%)'
                    : 'linear-gradient(75deg, transparent 0%, rgba(255,255,255,0.1) 42%, rgba(255,255,255,0.03) 50%, transparent 70%)',
            }}
          />
          <svg className="absolute inset-0 h-full w-full opacity-[0.24]" viewBox="0 0 1920 1080" preserveAspectRatio="none">
            <path
              d="M0 820 Q 480 680 960 760 T 1920 640"
              fill="none"
              stroke={curves.primary}
              strokeWidth="1.4"
            />
            <path
              d="M120 0 Q 640 280 1100 120 T 1920 200"
              fill="none"
              stroke={curves.secondary}
              strokeWidth="1"
            />
          </svg>
          <div
            className="absolute inset-0"
            style={{ background: `rgba(0,0,0,${presetDim})` }}
          />
        </>
      ) : null}

      {hasCustomMedia ? (
        <div className="absolute inset-0" style={{ background: `rgba(0,0,0,${dim})` }} />
      ) : null}
    </div>
  );
}
