'use client';

import { PointerNeonBird } from '@/components/wallet/analytics/PointerNeonBird';
import { presetMeta } from '@/lib/share/backgrounds';
import type { ShareBackgroundPresetId } from '@/lib/share/types';
import { cn } from '@/lib/utils/cn';

export const SHARE_CARD_TONE = {
  violet: {
    border: 'rgba(139,92,246,0.72)',
    borderGlow: 'rgba(124,58,237,0.35)',
    pattern: 'rgba(139,92,246,0.14)',
    patternFaint: 'rgba(139,92,246,0.07)',
    wordmarkFill: 'rgba(124,58,237,0.04)',
    wordmarkStroke: 'rgba(167,139,250,0.22)',
    tradeSub: '#a78bfa',
  },
  cyan: {
    border: 'rgba(34,211,238,0.55)',
    borderGlow: 'rgba(34,211,238,0.22)',
    pattern: 'rgba(34,211,238,0.12)',
    patternFaint: 'rgba(34,211,238,0.06)',
    wordmarkFill: 'rgba(34,211,238,0.04)',
    wordmarkStroke: 'rgba(158,252,255,0.18)',
    tradeSub: '#67e8f9',
  },
  slate: {
    border: 'rgba(148,163,184,0.45)',
    borderGlow: 'rgba(148,163,184,0.12)',
    pattern: 'rgba(148,163,184,0.1)',
    patternFaint: 'rgba(148,163,184,0.05)',
    wordmarkFill: 'rgba(203,213,225,0.03)',
    wordmarkStroke: 'rgba(203,213,225,0.14)',
    tradeSub: '#cbd5e1',
  },
} as const;

/** Tech grid + circuit accents — matches pointerpnlsharecard.png default scene. */
function ShareCardGeoPattern({ stroke, faint }: { stroke: string; faint: string }) {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full"
      viewBox="0 0 1280 720"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      <defs>
        <pattern id="pnl-share-grid" width="48" height="48" patternUnits="userSpaceOnUse">
          <path d="M48 0H0V48" fill="none" stroke={faint} strokeWidth="0.6" />
        </pattern>
      </defs>
      <rect width="1280" height="720" fill="url(#pnl-share-grid)" opacity="0.55" />

      {/* Corner brackets */}
      <path
        d="M36 52 H88 M36 52 V104 M1244 52 H1192 M1244 52 V104 M36 668 H88 M36 668 V616 M1244 668 H1192 M1244 668 V616"
        fill="none"
        stroke={stroke}
        strokeWidth="1.2"
        opacity="0.55"
      />

      {/* Diagonal slashes */}
      <path
        d="M1080 120 l48 48 M1120 180 l36 36 M180 560 l-40 40 M220 520 l-32 32"
        fill="none"
        stroke={stroke}
        strokeWidth="1"
        opacity="0.35"
      />

      {/* Plus markers */}
      {(
        [
          [220, 140],
          [340, 220],
          [960, 180],
          [1040, 320],
          [180, 480],
          [880, 560],
        ] as const
      ).map(([x, y]) => (
        <g key={`${x}-${y}`} opacity="0.45">
          <path d={`M${x - 6} ${y} H${x + 6} M${x} ${y - 6} V${y + 6}`} stroke={stroke} strokeWidth="1" />
        </g>
      ))}

      {/* Circuit traces */}
      <path
        d="M420 640 H620 V580 H780 M260 120 H420 V180 H560"
        fill="none"
        stroke={stroke}
        strokeWidth="0.9"
        opacity="0.28"
      />
    </svg>
  );
}

function ShareCardWordmark({
  fill,
  stroke,
  tradeColor,
}: {
  fill: string;
  stroke: string;
  tradeColor: string;
}) {
  return (
    <div className="pointer-events-none absolute inset-x-[1.5%] top-[1.5%] z-[1] h-[34%]">
      <svg viewBox="0 0 1280 260" className="h-full w-full" aria-hidden preserveAspectRatio="xMidYMid meet">
        <defs>
          <linearGradient id="pnl-share-wordmark-stroke" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={stroke} stopOpacity="0.08" />
            <stop offset="40%" stopColor={stroke} stopOpacity="1" />
            <stop offset="100%" stopColor={stroke} stopOpacity="0.12" />
          </linearGradient>
        </defs>
        <text
          x="50%"
          y="52%"
          textAnchor="middle"
          dominantBaseline="middle"
          fill={fill}
          stroke="url(#pnl-share-wordmark-stroke)"
          strokeWidth="1.4"
          style={{
            fontFamily: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
            fontWeight: 900,
            fontSize: '228px',
            letterSpacing: '-0.04em',
          }}
        >
          POINTER
        </text>
        <text
          x="78%"
          y="78%"
          textAnchor="start"
          fill={tradeColor}
          style={{
            fontFamily: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif',
            fontWeight: 800,
            fontSize: '34px',
            letterSpacing: '0.22em',
          }}
        >
          • TRADE
        </text>
      </svg>
    </div>
  );
}

/**
 * Default Pointer PNL share scene — purple frame, geo grid, backdrop wordmark, neon bird.
 * Shared by live card preview and kept in sync with canvas export in videoCanvasFrame.
 */
export function PnlShareCardChrome({
  backgroundId,
  hasCustomMedia = false,
  className,
}: {
  backgroundId: ShareBackgroundPresetId;
  hasCustomMedia?: boolean;
  className?: string;
}) {
  const meta = presetMeta(backgroundId);
  const tone = SHARE_CARD_TONE[meta.wordmarkTone];

  return (
    <div className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)} aria-hidden>
      {/* Purple frame */}
      <div
        className="absolute inset-0 rounded-[inherit]"
        style={{
          boxShadow: `inset 0 0 0 2px ${tone.border}, 0 0 42px -8px ${tone.borderGlow}`,
        }}
      />

      {!hasCustomMedia ? <ShareCardGeoPattern stroke={tone.pattern} faint={tone.patternFaint} /> : null}

      {hasCustomMedia ? (
        <div
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(105deg,rgba(4,2,12,0.9) 0%,rgba(4,2,12,0.52) 42%,rgba(4,2,12,0.78) 100%)',
          }}
        />
      ) : null}

      <ShareCardWordmark fill={tone.wordmarkFill} stroke={tone.wordmarkStroke} tradeColor={tone.tradeSub} />

      <div className="absolute inset-y-[-2%] right-[-6%] z-[1] flex items-center">
        <PointerNeonBird glow={meta.birdGlow} className="h-[128%] w-auto opacity-[0.98]" />
      </div>

      <div className="absolute inset-0 shadow-[inset_0_0_100px_rgba(0,0,0,0.5),inset_0_1px_0_rgba(255,255,255,0.04)]" />
    </div>
  );
}
