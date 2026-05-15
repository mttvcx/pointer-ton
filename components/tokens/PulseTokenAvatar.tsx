'use client';

import Image from 'next/image';
import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getPulseBondingRingState, PULSE_NEAR_MIGRATE_PCT } from '@/lib/tokens/bondingProgress';
import { cn } from '@/lib/utils/cn';
import type { PulseColumnId } from '@/lib/utils/constants';
import type { PulseTokenBundle } from '@/types/tokens';

/** Matches Tailwind `rounded-lg` (10px) — locked per Pulse polish spec G. */
const CORNER_RX = 10;
/** Skim-thin Terminal-style ring. Was 3 — that read as a heavy chrome outline; 1.5 hugs the image edge. */
const STROKE = 1.5;

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
  size,
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
  void size;
  const { token } = bundle;
  const showPumpDock = launchpadCorner && token.launch_pad === 'pump.fun';
  const pathRef = useRef<SVGPathElement | null>(null);
  const { d, lengthApprox } = useMemo(
    () => buildRoundedRectRingPath(64, STROKE, CORNER_RX),
    [],
  );
  const [pathLen, setPathLen] = useState(lengthApprox);
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(token.image_url) && !imageFailed;
  const fallbackInitials = (token.symbol ?? token.name ?? '??')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 2)
    .toUpperCase();

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

  return (
    <div
      className={cn(
        // `pulse-avatar` is the preference hook for avatar size — replaces the
        // previous `h-16 w-16` lock. Default size is 3rem (48px); compact 2.5rem,
        // large 3.5rem. Controlled via `:root[data-avatar-size]` in globals.css.
        'pulse-avatar relative shrink-0 rounded-lg',
        pumpFrame && 'shadow-[0_0_0_2px_rgba(52,211,153,0.9)]',
        className,
      )}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element -- Pulse rows render thousands of arbitrary token thumbnails; next/image loader overhead isn't worth it here.
        <img
          src={token.image_url!}
          alt={token.symbol ?? 'Token'}
          width={64}
          height={64}
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
          className="relative z-0 block h-full w-full rounded-lg object-cover"
        />
      ) : (
        <div
          className="relative z-0 flex h-full w-full items-center justify-center rounded-lg"
          aria-hidden
        >
          <span className="text-[10px] font-bold uppercase text-fg-muted">{fallbackInitials}</span>
        </div>
      )}
      {showRing ? (
      <svg
        className="pointer-events-none absolute inset-0 z-10 h-full w-full"
        width={64}
        height={64}
        viewBox={`0 0 ${64} ${64}`}
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
          className="absolute -bottom-1 -right-1 z-20 inline-flex items-center justify-center rounded-full ring-1 ring-bg-raised transition hover:scale-105"
          onClick={(e) => e.stopPropagation()}
        >
          <Image
            src="/icons/pumpfun.webp"
            alt="pump.fun"
            width={20}
            height={20}
            className="h-5 w-5 rounded-full"
          />
        </a>
      ) : null}
    </div>
  );
}
