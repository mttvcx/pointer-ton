'use client';

import { useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { getPulseBondingRingState } from '@/lib/tokens/bondingProgress';
import {
  type LaunchpadAvatarChrome,
} from '@/lib/tokens/launchpadAvatarChrome';
import { resolvePulseTokenImageUrl } from '@/lib/tokens/pulseTokenImageUrl';
import { useUIStore } from '@/store/ui';
import { protocolBrand, type ProtocolBrandId } from '@/lib/tokens/protocolBrand';
import { cn } from '@/lib/utils/cn';
import type { PulseColumnId } from '@/lib/utils/constants';
import type { PulseTokenBundle } from '@/types/tokens';

/** Universal Axiom/terminal square frame — thin stroke on the outer edge, image inset. */
const STROKE = 1.25;
const IMAGE_INSET = 2;

function cornerRadiusForBox(px: number): number {
  if (px <= 32) return 4;
  if (px <= 48) return 6;
  return 8;
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

function genericProgressColor(pct: number): string {
  if (pct <= 0) return 'rgba(255, 255, 255, 0.08)';
  if (pct < 50) return 'rgba(148, 163, 184, 0.82)';
  return 'rgba(0, 194, 122, 0.9)';
}

const MIGRATED_GOLD = 'rgba(245, 158, 11, 0.96)';
const MIGRATED_GOLD_TRACK = 'rgba(245, 158, 11, 0.24)';

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '').trim();
  if (h.length !== 6) return `rgba(255,255,255,${alpha})`;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function protocolTrackColor(
  protocolId: ProtocolBrandId | undefined,
  displayMigrated: boolean,
): string {
  if (displayMigrated) return MIGRATED_GOLD_TRACK;
  if (protocolId) {
    const brand = protocolBrand(protocolId);
    return hexToRgba(brand?.color ?? '#888888', 0.22);
  }
  return 'rgba(255, 255, 255, 0.07)';
}

function launchpadArcColor(
  protocolId: ProtocolBrandId | undefined,
  ringStrokeRgba: string | undefined,
  pct: number,
  displayMigrated: boolean,
): string | null {
  if (displayMigrated) return MIGRATED_GOLD;
  if (pct <= 0) return null;
  if (protocolId && ringStrokeRgba) return ringStrokeRgba;
  return null;
}

/** Axiom-style encircled launchpad chip — shell + inner logo scale. */
function cornerBadgeMetrics(
  avatarPx: number,
  protocolId: ProtocolBrandId,
  emphasis: 'default' | 'header' = 'default',
): { shellPx: number; iconPx: number } {
  const shellPx =
    emphasis === 'header' ? 18 : avatarPx >= 44 ? 14 : 11;
  const compactIcon =
    protocolId === 'pump.fun' || protocolId === 'mayhem' || protocolId === 'four.meme';
  // Orca's logo art has heavy built-in padding — render it flush to fill the shell
  // (matches meteora/bags/pump visual size) instead of a tiny icon deep in the circle.
  const fillIcon = protocolId === 'orca';
  const iconPx =
    emphasis === 'header'
      ? compactIcon
        ? 10
        : fillIcon
          ? 18
          : 14
      : compactIcon
        ? Math.max(6, shellPx - 5)
        : fillIcon
          ? shellPx
          : shellPx - 2;
  return { shellPx, iconPx };
}

function cornerBadgeRingColor(protocolId: ProtocolBrandId, isMigrated: boolean): string {
  if (isMigrated) return MIGRATED_GOLD;
  const brand = protocolBrand(protocolId);
  return hexToRgba(brand?.color ?? '#888888', 0.84);
}

function cornerBadgeInnerBg(protocolId: ProtocolBrandId): string | undefined {
  switch (protocolId) {
    case 'bonk':
      return '#f7931a';
    case 'moonshot':
      return '#a855f7';
    case 'moonit':
      return '#eab308';
    case 'orca':
      return undefined; // orca logo fills the shell — keep the bg dark so it doesn't clash
    case 'meteora':
      return undefined; // meteora logo is orange — dark bg so it pops (was orange-on-orange)
    case 'daos.fun':
      return '#38bdf8';
    case 'bags':
      return '#059669';
    default:
      return undefined;
  }
}

function LaunchpadCornerBadge({
  chrome,
  avatarPx,
  isMigrated,
  emphasis = 'default',
  imagePriority = false,
}: {
  chrome: LaunchpadAvatarChrome;
  avatarPx: number;
  isMigrated: boolean;
  emphasis?: 'default' | 'header';
  imagePriority?: boolean;
}) {
  const { shellPx, iconPx } = cornerBadgeMetrics(avatarPx, chrome.protocolId, emphasis);
  const ringColor = cornerBadgeRingColor(chrome.protocolId, isMigrated);
  const innerBg = isMigrated ? undefined : cornerBadgeInnerBg(chrome.protocolId);
  const ringWidth = emphasis === 'header' ? 1.75 : 1;
  // Orca fills the shell (object-cover, no inset) to defeat its padded logo art.
  const fillShell = chrome.protocolId === 'orca';
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={chrome.cornerLogo}
      alt=""
      width={iconPx}
      height={iconPx}
      draggable={false}
      loading={imagePriority ? 'eager' : 'lazy'}
      decoding={imagePriority ? 'sync' : 'async'}
      fetchPriority={imagePriority ? 'high' : 'auto'}
      className={cn(
        'block shrink-0',
        fillShell ? 'rounded-full object-cover' : 'object-contain',
        innerBg && 'rounded-full',
      )}
      style={{
        width: iconPx,
        height: iconPx,
        maxWidth: iconPx,
        maxHeight: iconPx,
        filter: isMigrated
          ? 'sepia(1) saturate(5) hue-rotate(5deg) brightness(1.08)'
          : undefined,
      }}
    />
  );
  const pos = cn(
    'absolute z-30 inline-flex items-center justify-center leading-none',
    emphasis === 'header' ? '-bottom-[3px] -right-[3px]' : '-bottom-px -right-px',
  );
  const wrap = (
    <span
      className="inline-flex items-center justify-center rounded-full bg-[#0a0b0d] shadow-[0_0_0_1px_rgba(0,0,0,0.85)]"
      style={{
        width: shellPx,
        height: shellPx,
        padding: fillShell ? 0 : emphasis === 'header' ? 2 : 1.5,
        boxShadow: `0 0 0 ${ringWidth}px ${ringColor}, 0 0 0 ${ringWidth + 1}px rgba(0,0,0,0.75)`,
        backgroundColor: innerBg ?? '#0a0b0d',
      }}
    >
      {img}
    </span>
  );
  if (chrome.cornerHref) {
    return (
      <a
        href={chrome.cornerHref}
        target="_blank"
        rel="noopener noreferrer"
        title={chrome.cornerTitle}
        aria-label={chrome.cornerTitle}
        className={cn(pos, 'cursor-pointer transition hover:scale-105')}
        onClick={(e) => e.stopPropagation()}
      >
        {wrap}
      </a>
    );
  }
  return (
    <span title={chrome.cornerTitle} aria-label={chrome.cornerTitle} className={pos}>
      {wrap}
    </span>
  );
}

export function PulseTokenAvatar({
  bundle,
  size = 48,
  className,
  showRing = true,
  launchpadChrome = null,
  columnId,
  ringPresentation = 'progress',
  cornerBadgeEmphasis = 'default',
  imagePriority = false,
}: {
  bundle: PulseTokenBundle;
  size?: number;
  className?: string;
  showRing?: boolean;
  launchpadChrome?: LaunchpadAvatarChrome | null;
  columnId?: PulseColumnId;
  /** Token header — full brand/migrated ring instead of bonding arc only. */
  ringPresentation?: 'progress' | 'brand-full';
  /** Larger protruding protocol circle (token detail header). */
  cornerBadgeEmphasis?: 'default' | 'header';
  /** Above-the-fold Pulse rows — skip lazy image deferral. */
  imagePriority?: boolean;
}) {
  const gradientId = useId().replace(/:/g, '');
  const pathRef = useRef<SVGPathElement | null>(null);
  const rx = cornerRadiusForBox(size);
  const innerRx = Math.max(3, rx - 1);
  const [pathLen, setPathLen] = useState(0);
  const [imageFailed, setImageFailed] = useState(false);
  const activeChain = useUIStore((s) => s.activeChain);
  const { token } = bundle;
  const imageSrc = resolvePulseTokenImageUrl(bundle, activeChain);
  const showImage = Boolean(imageSrc) && !imageFailed;
  const fallbackInitials = (token.symbol ?? token.name ?? '??')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 2)
    .toUpperCase();
  const fallbackFontPx = Math.max(9, Math.min(14, Math.round(size * 0.22)));

  const { fillPct, migrated } = getPulseBondingRingState(bundle);
  const migratedColumnLock = columnId === 'migrated' && showRing;
  const displayMigrated = migrated || migratedColumnLock;
  const migratedEmphasis = displayMigrated && showRing;
  const effectiveStroke = migratedEmphasis ? 2.25 : STROKE;
  const contentInset = IMAGE_INSET + effectiveStroke / 2;
  const innerSize = size - contentInset * 2;
  const { d, lengthApprox } = useMemo(
    () => buildRoundedRectRingPath(size, effectiveStroke, rx),
    [size, rx, effectiveStroke],
  );
  const brandFullRing = ringPresentation === 'brand-full' && Boolean(launchpadChrome);
  const ringFillPct =
    fillPct != null
      ? fillPct
      : migratedColumnLock
        ? 100
        : columnId === 'stretch' && !displayMigrated
          ? 88
          : null;
  const hasData = ringFillPct != null;
  const rawPct = hasData ? Math.min(100, Math.max(0, ringFillPct)) : 0;
  const pct = brandFullRing ? 100 : displayMigrated ? 100 : rawPct;

  const useLaunchpadProgress = Boolean(launchpadChrome && showRing);
  const useGenericProgress = Boolean(!launchpadChrome && showRing && (hasData || displayMigrated));

  const arcColor = useLaunchpadProgress
    ? launchpadArcColor(
        launchpadChrome!.protocolId,
        launchpadChrome!.ringStrokeRgba,
        pct,
        displayMigrated,
      )
    : useGenericProgress
      ? displayMigrated
        ? MIGRATED_GOLD
        : genericProgressColor(pct)
      : null;

  const ringStyle = launchpadChrome?.ringStyle;
  const useBrandGradient =
    !displayMigrated &&
    (ringStyle === 'raydium-gradient' ||
      ringStyle === 'printr-gradient' ||
      ringStyle === 'jupiter-studio-gradient' ||
      ringStyle === 'meteora-gradient');
  const showArc = (arcColor != null || useBrandGradient) && pct > 0;
  const arcStroke =
    migratedColumnLock && showRing
      ? MIGRATED_GOLD
      : useBrandGradient && showArc
        ? `url(#${gradientId})`
        : arcColor ?? undefined;
  const showTrack =
    showRing && (migratedColumnLock || useLaunchpadProgress || useGenericProgress);
  const trackColor = useLaunchpadProgress
    ? protocolTrackColor(launchpadChrome!.protocolId, displayMigrated)
    : displayMigrated
      ? MIGRATED_GOLD_TRACK
      : 'rgba(255, 255, 255, 0.07)';
  const fullRing = displayMigrated || pct >= 99.95;
  const arcLen = fullRing ? pathLen + effectiveStroke * 2 : pathLen * (pct / 100);
  const offset = 0;
  /** Complete rings use one stroke — track + arc stacked reads as a thick/double gold border. */
  const showDimTrack = showTrack && !fullRing;

  useLayoutEffect(() => {
    setPathLen(lengthApprox);
  }, [lengthApprox]);

  const imageClipStyle = {
    top: contentInset,
    left: contentInset,
    width: innerSize,
    height: innerSize,
    borderRadius: innerRx,
  } as const;

  useLayoutEffect(() => {
    if (!showTrack) return;
    const el = pathRef.current;
    if (el) {
      const L = el.getTotalLength();
      if (L > 0) setPathLen(L);
    }
  }, [d, showTrack, effectiveStroke]);

  return (
    <div
      className={cn('pulse-avatar relative shrink-0', migratedColumnLock && 'z-[5]')}
      style={{ width: size, height: size }}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageSrc!}
          alt={token.symbol ?? 'Token'}
          width={innerSize}
          height={innerSize}
          loading={imagePriority ? 'eager' : 'lazy'}
          fetchPriority={imagePriority ? 'high' : 'auto'}
          decoding="async"
          onError={() => setImageFailed(true)}
          className="absolute z-0 block object-cover"
          style={imageClipStyle}
        />
      ) : (
        <div
          className="absolute z-0 flex items-center justify-center bg-[#0f1419]"
          style={imageClipStyle}
          aria-hidden
        >
          <span
            className="font-bold uppercase text-fg-muted/80"
            style={{ fontSize: fallbackFontPx }}
          >
            {fallbackInitials}
          </span>
        </div>
      )}
      {showTrack ? (
        <svg
          className="pointer-events-none absolute inset-0 z-10 h-full w-full"
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          aria-hidden
        >
          <defs>
            <linearGradient id={gradientId} x1="0%" y1="100%" x2="100%" y2="0%">
              {ringStyle === 'printr-gradient' ? (
                <>
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.98" />
                  <stop offset="46%" stopColor="#c084fc" stopOpacity="0.96" />
                  <stop offset="100%" stopColor="#fb923c" stopOpacity="0.98" />
                </>
              ) : ringStyle === 'jupiter-studio-gradient' ? (
                <>
                  <stop offset="0%" stopColor="#fbbf24" stopOpacity="0.98" />
                  <stop offset="28%" stopColor="#fb7185" stopOpacity="0.96" />
                  <stop offset="52%" stopColor="#c084fc" stopOpacity="0.96" />
                  <stop offset="76%" stopColor="#22d3ee" stopOpacity="0.96" />
                  <stop offset="100%" stopColor="#4ade80" stopOpacity="0.98" />
                </>
              ) : ringStyle === 'meteora-gradient' ? (
                <>
                  <stop offset="0%" stopColor="#fb923c" stopOpacity="0.98" />
                  <stop offset="38%" stopColor="#f472b6" stopOpacity="0.96" />
                  <stop offset="72%" stopColor="#c084fc" stopOpacity="0.96" />
                  <stop offset="100%" stopColor="#a855f7" stopOpacity="0.98" />
                </>
              ) : (
                <>
                  <stop offset="0%" stopColor="#22d3ee" stopOpacity="0.98" />
                  <stop offset="52%" stopColor="#38bdf8" stopOpacity="0.96" />
                  <stop offset="100%" stopColor="#c084fc" stopOpacity="0.98" />
                </>
              )}
            </linearGradient>
          </defs>
          {showDimTrack ? (
            <path
              ref={pathRef}
              d={d}
              fill="none"
              stroke={trackColor}
              strokeWidth={effectiveStroke}
              strokeLinejoin="miter"
              strokeLinecap="butt"
            />
          ) : null}
          {fullRing && arcStroke ? (
            <path
              ref={showDimTrack ? undefined : pathRef}
              d={d}
              fill="none"
              stroke={arcStroke}
              strokeWidth={effectiveStroke}
              strokeLinejoin="miter"
              strokeLinecap="butt"
              style={migratedEmphasis ? { transition: 'none' } : undefined}
            />
          ) : showArc && arcStroke ? (
            <path
              ref={showDimTrack ? undefined : pathRef}
              d={d}
              fill="none"
              stroke={arcStroke}
              strokeWidth={effectiveStroke}
              strokeLinejoin="miter"
              strokeLinecap="butt"
              strokeDasharray={`${arcLen} ${pathLen + effectiveStroke * 2}`}
              strokeDashoffset={offset}
              style={{
                transition: 'stroke-dashoffset 0.35s ease, stroke 0.2s ease',
              }}
            />
          ) : null}
        </svg>
      ) : null}
      {launchpadChrome ? (
        <LaunchpadCornerBadge
          chrome={launchpadChrome}
          avatarPx={size}
          isMigrated={displayMigrated}
          emphasis={cornerBadgeEmphasis}
          imagePriority={imagePriority}
        />
      ) : null}
    </div>
  );
}
