'use client';

import type { ShareBackgroundPresetId } from '@/lib/share/types';
import { cn } from '@/lib/utils/cn';

const THEME_BLOOMS: Record<ShareBackgroundPresetId, string> = {
  midnight:
    'radial-gradient(ellipse 55% 45% at 18% 12%, rgba(255,255,255,0.08), transparent 60%), radial-gradient(ellipse 40% 35% at 82% 78%, rgba(180,180,200,0.06), transparent 55%)',
  onyx:
    'radial-gradient(ellipse 50% 40% at 20% 15%, rgba(255,255,255,0.06), transparent 58%), radial-gradient(ellipse 45% 38% at 75% 85%, rgba(148,163,184,0.05), transparent 55%)',
  glacier:
    'radial-gradient(ellipse 55% 45% at 15% 10%, rgba(103,232,249,0.1), transparent 58%), radial-gradient(ellipse 42% 36% at 88% 82%, rgba(224,242,254,0.07), transparent 55%)',
};

export function BackgroundLayer({
  theme = 'midnight',
  hasCustomMedia = false,
  overlayOpacity = 0.52,
  className,
}: {
  theme?: ShareBackgroundPresetId;
  hasCustomMedia?: boolean;
  overlayOpacity?: number;
  className?: string;
}) {
  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      {!hasCustomMedia ? (
        <>
          <div
            className="absolute inset-0"
            style={{
              background: 'linear-gradient(145deg, #000000 0%, #050505 42%, #0a0a0a 100%)',
            }}
          />
          <div className="absolute inset-0 opacity-90" style={{ background: THEME_BLOOMS[theme] }} />
          {/* Liquid-metal streaks */}
          <div
            className="absolute -left-[10%] top-[8%] h-[55%] w-[70%] rotate-[-24deg] opacity-30"
            style={{
              background:
                'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.03) 35%, rgba(255,255,255,0.12) 48%, rgba(200,200,210,0.06) 52%, transparent 68%)',
            }}
          />
          <div
            className="absolute -right-[5%] bottom-[5%] h-[45%] w-[55%] rotate-[18deg] opacity-25"
            style={{
              background:
                'linear-gradient(75deg, transparent 0%, rgba(255,255,255,0.08) 42%, rgba(255,255,255,0.02) 50%, transparent 70%)',
            }}
          />
          {/* Chrome curves */}
          <svg className="absolute inset-0 h-full w-full opacity-[0.18]" viewBox="0 0 1920 1080" preserveAspectRatio="none">
            <path
              d="M0 820 Q 480 680 960 760 T 1920 640"
              fill="none"
              stroke="rgba(255,255,255,0.35)"
              strokeWidth="1.2"
            />
            <path
              d="M120 0 Q 640 280 1100 120 T 1920 200"
              fill="none"
              stroke="rgba(255,255,255,0.15)"
              strokeWidth="0.8"
            />
          </svg>
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(255,255,255,0.04), transparent 65%)',
            }}
          />
        </>
      ) : null}

      {hasCustomMedia ? (
        <div
          className="absolute inset-0"
          style={{ background: `rgba(0,0,0,${Math.min(0.78, overlayOpacity + 0.2)})` }}
        />
      ) : null}
    </div>
  );
}
