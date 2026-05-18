'use client';

import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getPulseBondingRingState, PULSE_NEAR_MIGRATE_PCT } from '@/lib/tokens/bondingProgress';
import { cn } from '@/lib/utils/cn';
import type { PulseColumnId } from '@/lib/utils/constants';
import type { PulseTokenBundle } from '@/types/tokens';

/** Skim-thin Terminal-style ring; hugs the image edge. */
const STROKE = 1.5;

function cornerRadiusForBox(px: number): number {
  return Math.max(4, Math.min(12, Math.round(px * 0.156)));
}

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
  /** Pixel box; inline size overrides `pulse-avatar` preference vars when set. */
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
  const rx = cornerRadiusForBox(size);
  const { d, lengthApprox } = useMemo(
    () => buildRoundedRectRingPath(size, STROKE, rx),
    [size, rx],
  );
  const [pathLen, setPathLen] = useState(lengthApprox);
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(token.image_url) && !imageFailed;
  const fallbackInitials = (token.symbol ?? token.name ?? '??')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 2)
    .toUpperCase();

  const fallbackFontPx = Math.max(9, Math.min(14, Math.round(size * 0.22)));

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
  }, [d, displayMigrated, showRing]);

  const pumpBadgeLg = size >= 56;

  return (
    <div
      className={cn(
        // Preference `--avatar-size` still applies when no inline size is needed elsewhere;
        // here `style` width/height wins for Pulse rows / header explicit pixels.
        'pulse-avatar relative shrink-0 rounded-lg',
        pumpFrame && 'shadow-[0_0_0_2px_rgba(52,211,153,0.9)]',
        className,
      )}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- Pulse rows render thousands of arbitrary token thumbnails; next/image loader overhead isn't worth it here.
        <img
          src={token.image_url!}
          alt={token.symbol ?? 'Token'}
          width={size}
          height={size}
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
          className="relative z-0 block h-full w-full rounded-lg object-cover"
        />
      ) : (
        <div
          className="relative z-0 flex h-full w-full items-center justify-center rounded-lg bg-bg-elevated/40"
          aria-hidden
        >
          <span
            className="font-bold uppercase text-fg-muted"
            style={{ fontSize: fallbackFontPx }}
          >
            {fallbackInitials}
          </span>
        </div>
      )}
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
          title="Open on pump.fun"
          aria-label="pump.fun"
          className={cn(
            'absolute z-20 inline-flex items-center justify-center transition hover:scale-105',
            pumpBadgeLg ? '-bottom-0.5 -right-0.5' : '-bottom-1 -right-1',
          )}
          onClick={(e) => e.stopPropagation()}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/pumpfun.webp"
            alt=""
            width={pumpBadgeLg ? 22 : 20}
            height={pumpBadgeLg ? 22 : 20}
            draggable={false}
            className={cn(
              pumpBadgeLg ? 'h-[22px] w-[22px]' : 'h-5 w-5',
              'rounded-full object-cover ring-1 ring-black/40 drop-shadow-[0_1px_3px_rgba(0,0,0,0.65)]',
            )}
          />
        </a>
      ) : null}
    </div>
  );
}
