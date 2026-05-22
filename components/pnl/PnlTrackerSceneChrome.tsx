'use client';

import { useId } from 'react';
import { PointerNeonBird } from '@/components/wallet/analytics/PointerNeonBird';
import { presetMeta } from '@/lib/share/backgrounds';
import type { ShareBackgroundPresetId } from '@/lib/share/types';
import { cn } from '@/lib/utils/cn';

export const PNL_WORDMARK_TONE = {
  violet: { fill: 'rgba(138,107,255,0.06)', stroke: 'rgba(168,139,255,0.18)' },
  cyan: { fill: 'rgba(92,242,255,0.05)', stroke: 'rgba(158,252,255,0.16)' },
  slate: { fill: 'rgba(203,213,225,0.04)', stroke: 'rgba(203,213,225,0.14)' },
} as const;

/** Faded cinematic POINTER wordmark — shared by floating tracker + share cards. */
export function PnlBackdropWordmark({
  fill,
  stroke,
  className,
}: {
  fill: string;
  stroke: string;
  className?: string;
}) {
  const fadeId = useId().replace(/:/g, '');

  return (
    <div className={cn('pointer-events-none flex', className)}>
      <svg viewBox="0 0 1200 220" preserveAspectRatio="xMidYMid meet" className="h-full w-full" aria-hidden>
        <defs>
          <linearGradient id={`pnl-wordmark-fade-${fadeId}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.05" />
            <stop offset="35%" stopColor={stroke} stopOpacity="1" />
            <stop offset="78%" stopColor={stroke} stopOpacity="0.55" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.05" />
          </linearGradient>
        </defs>
        <text
          x="50%"
          y="58%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={fill}
          stroke={`url(#pnl-wordmark-fade-${fadeId})`}
          strokeWidth={1.2}
          style={{
            fontFamily: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
            fontWeight: 900,
            fontSize: '210px',
            letterSpacing: '-0.045em',
          }}
        >
          POINTER
        </text>
      </svg>
    </div>
  );
}

/**
 * Purple neon bird + faded POINTER backdrop — the default PNL tracker look.
 * Sits above preset/custom media, under balance/PNL numbers.
 */
export function PnlTrackerSceneChrome({
  backgroundId,
  hasCustomMedia = false,
  compact = false,
  className,
}: {
  backgroundId: ShareBackgroundPresetId;
  hasCustomMedia?: boolean;
  /** Smaller hero bird + wordmark for the floating dock widget */
  compact?: boolean;
  className?: string;
}) {
  const meta = presetMeta(backgroundId);
  const tone = PNL_WORDMARK_TONE[meta.wordmarkTone];

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      {hasCustomMedia ? (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg,rgba(3,5,9,0.82) 0%,rgba(3,5,9,0.48) 46%,rgba(3,5,9,0.72) 100%)',
          }}
        />
      ) : null}

      <PnlBackdropWordmark
        fill={tone.fill}
        stroke={tone.stroke}
        className={cn(
          'absolute inset-x-[2%]',
          compact ? 'top-[-8%] h-[62%]' : 'top-[3%] h-[38%]',
        )}
      />

      <div
        className={cn(
          'absolute flex items-center',
          compact ? 'inset-y-[-10%] right-[-22%]' : 'inset-y-0 right-[-4%]',
        )}
      >
        <PointerNeonBird
          glow={meta.birdGlow}
          className={cn(
            'w-auto opacity-[0.92]',
            compact ? 'h-[130%] -translate-y-[2%]' : 'h-[122%] -translate-y-[3%]',
          )}
        />
      </div>

      <div className="absolute inset-0 shadow-[inset_0_0_72px_rgba(0,0,0,0.48),inset_0_1px_0_rgba(255,255,255,0.04)]" />
    </div>
  );
}
