'use client';

import { forwardRef, type RefObject } from 'react';
import { cn } from '@/lib/utils/cn';
import { presetClass, presetMeta } from '@/lib/share/backgrounds';
import type { PnlSharePayload } from '@/lib/share/types';
import type { ShareOverlaySettings } from '@/lib/share/types';
import type { ShareBackgroundPresetId } from '@/lib/share/types';
import {
  DEFAULT_SHARE_HEADLINE,
  MAX_SHARE_HEADLINE_CHARS,
} from '@/lib/share/types';
import { formatCompactUsd } from '@/lib/utils/formatters';
import {
  PnlMomentAmount,
  type PnlMomentBasis,
} from '@/components/wallet/analytics/PnlMomentAmount';
import { PointerNeonBird } from '@/components/wallet/analytics/PointerNeonBird';

const WORDMARK_TONE: Record<
  ReturnType<typeof presetMeta>['wordmarkTone'],
  { fill: string; stroke: string }
> = {
  violet: { fill: 'rgba(138,107,255,0.06)', stroke: 'rgba(168,139,255,0.18)' },
  cyan: { fill: 'rgba(92,242,255,0.05)', stroke: 'rgba(158,252,255,0.16)' },
  slate: { fill: 'rgba(203,213,225,0.04)', stroke: 'rgba(203,213,225,0.14)' },
};

export const PnlShareCard = forwardRef<
  HTMLDivElement,
  {
    payload: PnlSharePayload;
    overlay: ShareOverlaySettings;
    backgroundId: ShareBackgroundPresetId;
    customImageSrc?: string | null;
    imagePan?: { x: number; y: number };
    imageZoom?: number;
    /** Primary flex number inside the accent box (includes unit). */
    amountPrimary?: string | null;
    videoSrc?: string | null;
    /** Disable video autoplay (export frame capture) */
    videoPaused?: boolean;
    videoRef?: RefObject<HTMLVideoElement | null>;
    videoPan?: { x: number; y: number };
    videoZoom?: number;
    videoMuted?: boolean;
    headlineText?: string;
    referralCode?: string | null;
    editableHeadline?: boolean;
    onHeadlineChange?: (value: string) => void;
    className?: string;
    /** Interpolation target for hero amount (USD or SOL); omit to infer USD from payload */
    amountMotionBasis?: PnlMomentBasis | null;
    /** True while capturing PNG — shows settled hero typography (no motion) */
    amountMotionFrozen?: boolean;
    /** Bump to replay amount entrance (e.g. wallet + ticker + basis) */
    amountRevealKey?: string;
  }
>(function PnlShareCard(
  {
    payload,
    overlay,
    backgroundId,
    customImageSrc,
    imagePan = { x: 0, y: 0 },
    imageZoom = 1,
    amountPrimary,
    videoSrc,
    videoPaused,
    videoRef,
    videoPan = { x: 0, y: 0 },
    videoZoom = 1,
    videoMuted = false,
    headlineText = DEFAULT_SHARE_HEADLINE,
    referralCode,
    editableHeadline,
    onHeadlineChange,
    className,
    amountMotionBasis: amountMotionBasisProp,
    amountMotionFrozen = false,
    amountRevealKey: amountRevealKeyProp,
  },
  ref,
) {
  const meta = presetMeta(backgroundId);
  const pos = payload.pnlUsd != null && payload.pnlUsd >= 0;
  const pnlColor = pos ? '#3DDC97' : '#FF5E78';

  const mainAmt =
    amountPrimary ??
    (payload.pnlUsd == null
      ? '—'
      : payload.pnlUsd >= 0
        ? `+${formatCompactUsd(payload.pnlUsd)}`
        : formatCompactUsd(payload.pnlUsd));

  const pctStr =
    payload.pnlPct == null
      ? null
      : `${payload.pnlPct >= 0 ? '+' : ''}${payload.pnlPct.toFixed(2)}%`;

  const headlineValue =
    headlineText == null ? DEFAULT_SHARE_HEADLINE : headlineText.slice(0, MAX_SHARE_HEADLINE_CHARS);
  const displayHeadline = headlineValue.trim();

  const rawHandle = (referralCode || 'pointer').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 18) || 'pointer';
  const handle = `@${rawHandle}`;

  const motionBasis: PnlMomentBasis | null =
    amountMotionBasisProp !== undefined
      ? amountMotionBasisProp
      : payload.pnlUsd != null && Number.isFinite(payload.pnlUsd)
        ? { kind: 'usd', value: payload.pnlUsd }
        : null;

  const momentRevealKey =
    amountRevealKeyProp ??
    `${payload.walletAddress}|${payload.tokenTicker}|${mainAmt}|${payload.pnlUsd ?? ''}`;

  const tone = WORDMARK_TONE[meta.wordmarkTone];
  const ticker = (payload.tokenTicker || 'TOKEN').replace(/^\$+/, '').slice(0, 18).toUpperCase();
  const tokenName = payload.tokenName ?? null;

  const showCustomMedia = Boolean(customImageSrc || videoSrc);

  return (
    <div
      ref={ref}
      className={cn(
        'relative aspect-video w-full overflow-hidden rounded-[14px] border border-white/[0.08] shadow-[0_28px_90px_-44px_rgba(0,0,0,0.95)]',
        !showCustomMedia && presetClass(backgroundId),
        className,
      )}
    >
      {videoSrc ? (
        <video
          ref={videoRef}
          className="absolute inset-0 h-full w-full object-cover"
          src={videoSrc}
          muted={videoMuted}
          playsInline
          loop
          autoPlay={!videoPaused}
          preload="metadata"
          style={{
            transform: `translate(${videoPan.x}%, ${videoPan.y}%) scale(${videoZoom})`,
            transformOrigin: 'center center',
          }}
        />
      ) : null}

      {customImageSrc && !videoSrc ? (
        <div className="absolute inset-0 overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={customImageSrc}
            alt=""
            className="h-full w-full object-cover"
            style={{
              transform: `translate(${imagePan.x}px, ${imagePan.y}px) scale(${imageZoom})`,
              transformOrigin: 'center center',
            }}
          />
        </div>
      ) : null}

      {showCustomMedia ? (
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(90deg,rgba(3,5,9,0.88) 0%,rgba(3,5,9,0.55) 48%,rgba(3,5,9,0.78) 100%)',
            opacity: Math.min(1, overlay.overlayOpacity + 0.18),
          }}
        />
      ) : null}

      {/* Cinematic backdrop wordmark (sits under everything, faded) */}
      <BackdropWordmark fill={tone.fill} stroke={tone.stroke} />

      {/* Hero bird, right side */}
      <div className="pointer-events-none absolute inset-y-0 right-[-4%] z-[1] flex items-center">
        <PointerNeonBird
          glow={meta.birdGlow}
          className="h-[122%] w-auto -translate-y-[3%] opacity-[0.95]"
        />
      </div>

      {/* Soft inner vignette over scene */}
      <div className="pointer-events-none absolute inset-0 z-[2] shadow-[inset_0_0_120px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.05)]" />

      {/* Content */}
      <div
        className="relative z-[3] flex h-full w-full flex-col px-[4.4%] py-[4.6%]"
        style={{ transform: `scale(${overlay.textScale})`, transformOrigin: 'top left' }}
      >
        {/* Top bar: brand on left */}
        <div className="flex items-center gap-2.5">
          <PointerNeonBird glow={meta.birdGlow} className="h-7 w-7" />
          <span className="text-[12px] font-bold uppercase tracking-[0.18em] text-white/95">
            pointer.trade
          </span>
          <span className="h-1 w-1 rounded-full bg-white/55" aria-hidden />
        </div>

        {/* Headline pill */}
        <div className="mt-[2.4%]">
          {editableHeadline ? (
            <label className="group relative inline-block max-w-[60%]">
              <span className="pointer-events-none absolute -top-2.5 left-3 rounded bg-sky-400/90 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-[#03101f] opacity-0 transition group-hover:opacity-95 group-focus-within:opacity-95">
                edit text
              </span>
              <span className="inline-flex items-center gap-2 rounded-md border border-white/[0.1] bg-black/40 px-3 py-1.5 text-left">
                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/85" aria-hidden />
                <input
                  value={headlineValue}
                  maxLength={MAX_SHARE_HEADLINE_CHARS}
                  onChange={(e) => onHeadlineChange?.(e.target.value)}
                  placeholder="edit headline..."
                  className="w-[clamp(240px,28vw,440px)] bg-transparent text-[11px] font-bold uppercase tracking-[0.09em] text-white/90 outline-none placeholder:text-white/30"
                  aria-label="Edit share card headline"
                />
              </span>
            </label>
          ) : displayHeadline ? (
            <span className="inline-flex max-w-[60%] items-center gap-2 truncate rounded-md border border-white/[0.1] bg-black/40 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.09em] text-white/85">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-white/85" aria-hidden />
              {displayHeadline}
            </span>
          ) : null}
        </div>

        {/* Token title block */}
        <div className="mt-[4.5%]">
          <h2
            className="font-black uppercase leading-[0.92] text-white drop-shadow-[0_1px_0_rgba(0,0,0,0.4)]"
            style={{
              fontSize: `clamp(40px, 7.6vw, 84px)`,
              letterSpacing: '-0.02em',
            }}
          >
            {ticker}
          </h2>
          {overlay.showTokenName && tokenName ? (
            <p
              className="mt-1.5 font-semibold uppercase tracking-[0.16em]"
              style={{
                color: pos ? '#c4b5fd' : '#fda4af',
                fontSize: `clamp(11px, 1.5vw, 18px)`,
                opacity: 0.92,
              }}
            >
              {tokenName.slice(0, 28)}
            </p>
          ) : null}
        </div>

        {/* PnL hero box */}
        <div className="mt-[2.6%]">
          <div
            className="relative inline-flex items-center rounded-[10px] border px-[2.2vw] py-[1.4vw]"
            style={{
              minWidth: 'min(56%, 520px)',
              background: 'linear-gradient(180deg, rgba(8,11,18,0.92), rgba(4,6,11,0.92))',
              borderColor: 'rgba(255,255,255,0.085)',
              boxShadow:
                '0 22px 60px -34px rgba(0,0,0,0.85), inset 0 1px 0 rgba(255,255,255,0.04)',
            }}
          >
            <PnlMomentAmount
              basis={motionBasis}
              fallbackText={mainAmt}
              frozen={amountMotionFrozen}
              revealKey={momentRevealKey}
              positive={pos}
              className="font-black tabular-nums leading-none"
              style={{
                color: pnlColor,
                fontSize: `clamp(36px, 5.6vw, 64px)`,
                letterSpacing: '-0.015em',
                textShadow: pos
                  ? '0 0 28px rgba(61,220,151,0.32)'
                  : '0 0 28px rgba(255,94,120,0.28)',
              }}
            />
            <span
              className="pointer-events-none absolute left-3 right-3 bottom-2 h-[1px]"
              style={{
                background:
                  'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.16) 38%, rgba(255,255,255,0) 100%)',
              }}
              aria-hidden
            />
            <span
              className="pointer-events-none absolute bottom-[3px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full"
              style={{ background: pnlColor, boxShadow: `0 0 10px ${pnlColor}` }}
              aria-hidden
            />
          </div>
        </div>

        {/* Stat block */}
        <dl
          className="mt-[2.4%] grid w-fit gap-y-1 text-[clamp(11px,1.45vw,16px)] tabular-nums"
          style={{ gridTemplateColumns: 'auto auto', columnGap: 'clamp(20px, 3vw, 44px)' }}
        >
          <dt className="font-semibold uppercase tracking-[0.16em] text-white/55">PNL</dt>
          <dd className="font-bold" style={{ color: pnlColor }}>
            {mainAmt}
            {pctStr ? <span className="ml-2 text-white/55 font-medium">({pctStr})</span> : null}
          </dd>
          {!overlay.compactStats ? (
            <>
              <dt className="font-semibold uppercase tracking-[0.16em] text-white/55">Invested</dt>
              <dd className="font-bold text-white/92">
                {payload.investedUsd == null ? '—' : formatCompactUsd(payload.investedUsd)}
              </dd>
              <dt className="font-semibold uppercase tracking-[0.16em] text-white/55">Position</dt>
              <dd className="font-bold text-white/92">
                {payload.positionUsd == null ? '—' : formatCompactUsd(payload.positionUsd)}
              </dd>
            </>
          ) : null}
        </dl>

        {/* Spacer pushes footer down */}
        <div className="flex-1" />

        {/* Footer */}
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-center gap-2 text-white/72">
            <GlobeMark className="h-3.5 w-3.5 opacity-90" />
            <span className="text-[clamp(10px,1.25vw,13px)] font-bold uppercase tracking-[0.18em]">
              pointer.trade/{rawHandle.toLowerCase()}
            </span>
          </div>
          {overlay.showBranding ? (
            <span
              className="text-white"
              style={{
                fontSize: `clamp(18px, 2.4vw, 28px)`,
                fontWeight: 700,
                letterSpacing: '-0.01em',
                textShadow: '0 1px 0 rgba(0,0,0,0.4)',
              }}
            >
              {handle}
            </span>
          ) : null}
        </div>
      </div>
    </div>
  );
});

PnlShareCard.displayName = 'PnlShareCard';

function GlobeMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.6 3 4 6 4 9s-1.4 6-4 9c-2.6-3-4-6-4-9s1.4-6 4-9z" />
    </svg>
  );
}

/**
 * Faded huge "POINTER" wordmark spanning the upper area — pure typography,
 * acts as cinematic backdrop. Uses outline + low-fill so the bird and PNL stay focal.
 */
function BackdropWordmark({ fill, stroke }: { fill: string; stroke: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-[3%] top-[3%] z-[1] flex">
      <svg
        viewBox="0 0 1200 220"
        preserveAspectRatio="xMidYMid meet"
        className="h-auto w-full"
        aria-hidden
      >
        <defs>
          <linearGradient id="pnl-wordmark-fade" x1="0" y1="0" x2="1" y2="0">
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
          stroke="url(#pnl-wordmark-fade)"
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
