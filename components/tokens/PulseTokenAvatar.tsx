'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { TokenImage } from '@/components/shared/TokenImage';
import { getPulseBondingRingState, PULSE_NEAR_MIGRATE_PCT } from '@/lib/tokens/bondingProgress';
import { cn } from '@/lib/utils/cn';
import type { PulseColumnId } from '@/lib/utils/constants';
import type { PulseTokenBundle } from '@/types/tokens';

/** Matches Tailwind `rounded-md` (6px). */
const CORNER_RX = 6;
const STROKE = 3;

function buildRoundedRectRingPath(
  size: number,
  stroke: number,
  rxVisual: number,
): { d: string; lengthApprox: number } {
  const inset = stroke / 2;
  const w = size - stroke;
  const h = size - stroke;
  const x = inset;
  const y = inset;
  const r = Math.max(
    0,
    Math.min(rxVisual - inset, w / 2 - 1e-4, h / 2 - 1e-4),
  );
  const xm = x + w / 2;
  const d = [
    `M ${xm},${y}`,
    `H ${x + w - r}`,
    `A ${r},${r} 0 0 1 ${x + w},${y + r}`,
    `V ${y + h - r}`,
    `A ${r},${r} 0 0 1 ${x + w - r},${y + h}`,
    `H ${x + r}`,
    `A ${r},${r} 0 0 1 ${x},${y + h - r}`,
    `V ${y + r}`,
    `A ${r},${r} 0 0 1 ${x + r},${y}`,
    `H ${xm}`,
    'Z',
  ].join(' ');
  const lengthApprox = 2 * (w + h - 4 * r) + 2 * Math.PI * r;
  return { d, lengthApprox };
}

function progressStrokeColor(
  displayMigrated: boolean,
  nearMigrate: boolean,
  hasData: boolean,
  pct: number,
): string | null {
  if (displayMigrated) return null;
  if (nearMigrate) return 'rgba(56, 189, 248, 0.96)';
  if (!hasData || pct <= 0) return null;
  if (pct < 50) return 'rgba(100, 116, 139, 0.88)';
  if (pct < PULSE_NEAR_MIGRATE_PCT) return 'rgba(52, 211, 153, 0.92)';
  return 'rgba(56, 189, 248, 0.96)';
}

export function PulseTokenAvatar({
  bundle,
  size = 48,
  className,
  showRing = true,
  /** Bright TON launchpad frame (on-curve) — Axiom-style outline outside the image. */
  pumpFrame = false,
  /** Pump.fun dock badge (bottom-right). */
  launchpadCorner = false,
  /** Migrated column: ring reads as completed (gold) even if `migrated_at` lags indexing. */
  columnId,
}: {
  bundle: PulseTokenBundle;
  size?: number;
  className?: string;
  /** When false, hide the bonding curve ring overlay (display preset). */
  showRing?: boolean;
  pumpFrame?: boolean;
  launchpadCorner?: boolean;
  columnId?: PulseColumnId;
}) {
  const { token } = bundle;
  const showPumpDock = launchpadCorner && token.launch_pad === 'pump.fun';
  const pathRef = useRef<SVGPathElement | null>(null);
  const { d, lengthApprox } = useMemo(
    () => buildRoundedRectRingPath(size, STROKE, CORNER_RX),
    [size],
  );
  const [pathLen, setPathLen] = useState(lengthApprox);

  const { fillPct, migrated } = getPulseBondingRingState(bundle);
  const displayMigrated = migrated || columnId === 'migrated';
  /** Stretch lane: assume late-curve when indexer hasn’t surfaced F yet (ring preview only). */
  const ringFillPct =
    fillPct != null
      ? fillPct
      : columnId === 'stretch' && !displayMigrated
        ? 88
        : null;
  const hasData = ringFillPct != null;
  const rawPct = hasData ? Math.min(100, Math.max(0, ringFillPct)) : 0;
  const pct = displayMigrated ? 100 : rawPct;

  const nearMigrate =
    !displayMigrated && hasData && ringFillPct != null && ringFillPct >= PULSE_NEAR_MIGRATE_PCT;

  const unknown = !displayMigrated && !hasData;
  const trackColor = unknown
    ? 'rgba(30, 41, 59, 0.65)'
    : nearMigrate
      ? 'rgba(12, 74, 110, 0.42)'
      : 'rgba(51, 65, 85, 0.38)';

  const progColor = progressStrokeColor(displayMigrated, nearMigrate, hasData, pct);
  const offset = displayMigrated || pct >= 100 ? 0 : pathLen * (1 - pct / 100);

  useLayoutEffect(() => {
    if (!showRing || displayMigrated) return;
    const el = pathRef.current;
    if (el) {
      const L = el.getTotalLength();
      if (L > 0) setPathLen(L);
    }
  }, [d, size, displayMigrated, showRing]);

  return (
    <div
      className={cn(
        'relative shrink-0 rounded-md',
        pumpFrame &&
          'shadow-[0_0_0_2px_rgba(52,211,153,0.9),0_0_14px_rgba(52,211,153,0.28)]',
        className,
      )}
      style={{ width: size, height: size }}
    >
      <TokenImage
        src={token.image_url}
        alt={token.symbol ?? 'Token'}
        size={size}
        className="relative z-0 !rounded-md !ring-0"
      />
      {showRing ? (
      <svg
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden
      >
        {displayMigrated ? (
          <path
            d={d}
            fill="none"
            stroke="rgba(245, 158, 11, 0.98)"
            strokeWidth={STROKE}
            strokeLinejoin="round"
            strokeLinecap="butt"
          />
        ) : (
          <>
            <path
              ref={pathRef}
              d={d}
              fill="none"
              stroke={trackColor}
              strokeWidth={STROKE}
              strokeLinejoin="round"
              strokeLinecap="butt"
            />
            {progColor ? (
              <path
                d={d}
                fill="none"
                stroke={progColor}
                strokeWidth={STROKE}
                strokeLinejoin="round"
                strokeLinecap="butt"
                strokeDasharray={`${pathLen} ${pathLen}`}
                strokeDashoffset={offset}
                style={{
                  transition: 'stroke-dashoffset 0.35s ease, stroke 0.2s ease',
                }}
              />
            ) : null}
          </>
        )}
      </svg>
      ) : null}
      {showPumpDock ? (
        <a
          href={`https://pump.fun/${encodeURIComponent(token.mint)}`}
          target="_blank"
          rel="noopener noreferrer"
          title="Open on TON launchpad"
          aria-label="TON launchpad"
          className="absolute bottom-0.5 right-0.5 z-20 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[#030806] shadow-[0_0_0_1px_rgba(0,0,0,0.45)] ring-1 ring-emerald-300/90 transition hover:scale-105 hover:bg-emerald-400"
          onClick={(e) => e.stopPropagation()}
        >
          <svg viewBox="0 0 16 16" fill="none" className="h-2.5 w-2.5" aria-hidden>
            <path
              d="M8 2.5v2.2M8 4.7c-2.2 0-3.8 1.5-3.8 3.4 0 1.1.6 2.1 1.5 2.6"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M8 4.7c2.2 0 3.8 1.5 3.8 3.4 0 1.1-.6 2.1-1.5 2.6"
              stroke="currentColor"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="8" cy="10.8" r="1.1" stroke="currentColor" strokeWidth="1.4" />
          </svg>
        </a>
      ) : null}
    </div>
  );
}
