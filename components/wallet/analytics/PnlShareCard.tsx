'use client';

import { forwardRef, type RefObject } from 'react';
import { cn } from '@/lib/utils/cn';
import { presetClass } from '@/lib/share/backgrounds';
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
import { PointerBirdMark } from '@/components/branding/PointerBirdMark';
import { PnlShareCardChrome, SHARE_CARD_TONE } from '@/components/wallet/analytics/PnlShareCardChrome';
import { presetMeta } from '@/lib/share/backgrounds';

export const PnlShareCard = forwardRef<
  HTMLDivElement,
  {
    payload: PnlSharePayload;
    overlay: ShareOverlaySettings;
    backgroundId: ShareBackgroundPresetId;
    customImageSrc?: string | null;
    imagePan?: { x: number; y: number };
    imageZoom?: number;
    amountPrimary?: string | null;
    videoSrc?: string | null;
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
    amountMotionBasis?: PnlMomentBasis | null;
    amountMotionFrozen?: boolean;
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
  const tone = SHARE_CARD_TONE[meta.wordmarkTone];
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
  const displayHeadline = headlineValue.trim().toUpperCase();

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

  const ticker = (payload.tokenTicker || 'TOKEN').replace(/^\$+/, '').slice(0, 18).toUpperCase();
  const tokenName = payload.tokenName ?? null;
  const showCustomMedia = Boolean(customImageSrc || videoSrc);

  return (
    <div
      ref={ref}
      className={cn(
        'relative aspect-video w-full overflow-hidden rounded-[10px] shadow-[0_32px_100px_-40px_rgba(0,0,0,0.95)]',
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
          className="pointer-events-none absolute inset-0 z-[1]"
          style={{
            background:
              'linear-gradient(105deg,rgba(4,2,12,0.88) 0%,rgba(4,2,12,0.5) 44%,rgba(4,2,12,0.76) 100%)',
            opacity: Math.min(1, overlay.overlayOpacity + 0.22),
          }}
        />
      ) : null}

      <PnlShareCardChrome backgroundId={backgroundId} hasCustomMedia={showCustomMedia} />

      <div
        className="relative z-[3] flex h-full w-full flex-col px-[4.8%] py-[4.8%]"
        style={{ transform: `scale(${overlay.textScale})`, transformOrigin: 'top left' }}
      >
        {/* Brand row */}
        <div className="flex items-center gap-2">
          <PointerBirdMark size={26} className="opacity-95" />
          <span
            className="text-[13px] font-extrabold uppercase tracking-[0.2em]"
            style={{ fontFamily: 'var(--font-inter), ui-sans-serif, system-ui, sans-serif' }}
          >
            <span className="text-white">POINTER</span>
            <span style={{ color: tone.tradeSub }}>.TRADE</span>
          </span>
        </div>

        {/* Cashback / headline pill */}
        {overlay.showCashbackFooter && displayHeadline ? (
          <div className="mt-[2.8%]">
            {editableHeadline ? (
              <label className="group relative inline-block max-w-[72%]">
                <span className="pointer-events-none absolute -top-2.5 left-3 rounded bg-violet-500/90 px-1.5 py-0.5 text-[7px] font-bold uppercase tracking-[0.1em] text-white opacity-0 transition group-hover:opacity-95 group-focus-within:opacity-95">
                  edit text
                </span>
                <span className="inline-flex max-w-full items-center gap-2 rounded-md border border-white/[0.08] bg-black/55 px-3 py-1.5">
                  <span
                    className="h-1.5 w-1.5 shrink-0 rounded-full"
                    style={{ background: tone.tradeSub }}
                    aria-hidden
                  />
                  <input
                    value={headlineValue}
                    maxLength={MAX_SHARE_HEADLINE_CHARS}
                    onChange={(e) => onHeadlineChange?.(e.target.value)}
                    placeholder="edit headline..."
                    className="w-[clamp(220px,32vw,480px)] bg-transparent text-[10.5px] font-bold uppercase tracking-[0.1em] text-white/88 outline-none placeholder:text-white/30"
                    aria-label="Edit share card headline"
                  />
                </span>
              </label>
            ) : (
              <span className="inline-flex max-w-[72%] items-center gap-2 truncate rounded-md border border-white/[0.08] bg-black/55 px-3 py-1.5 text-[10.5px] font-bold uppercase tracking-[0.1em] text-white/88">
                <span
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: tone.tradeSub }}
                  aria-hidden
                />
                {displayHeadline}
              </span>
            )}
          </div>
        ) : null}

        {/* Token block */}
        <div className="mt-[4.2%]">
          <h2
            className="font-black uppercase leading-[0.9] text-white"
            style={{
              fontSize: 'clamp(42px, 7.8vw, 88px)',
              letterSpacing: '-0.025em',
              textShadow: '0 2px 18px rgba(0,0,0,0.45)',
            }}
          >
            {ticker}
          </h2>
          {overlay.showTokenName && tokenName ? (
            <p
              className="mt-1 font-bold uppercase tracking-[0.2em]"
              style={{
                color: tone.tradeSub,
                fontSize: 'clamp(11px, 1.55vw, 17px)',
              }}
            >
              {tokenName.slice(0, 28)}
            </p>
          ) : null}
        </div>

        {/* Hero PNL box */}
        <div className="mt-[2.4%]">
          <div
            className="relative inline-flex items-center rounded-[11px] border px-[2.4vw] py-[1.5vw]"
            style={{
              minWidth: 'min(58%, 540px)',
              background: 'linear-gradient(180deg, rgba(6,8,14,0.94), rgba(2,4,8,0.94))',
              borderColor: 'rgba(255,255,255,0.09)',
              boxShadow: '0 24px 64px -36px rgba(0,0,0,0.9), inset 0 1px 0 rgba(255,255,255,0.05)',
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
                fontSize: 'clamp(38px, 5.8vw, 68px)',
                letterSpacing: '-0.02em',
                textShadow: pos
                  ? '0 0 32px rgba(61,220,151,0.38)'
                  : '0 0 32px rgba(255,94,120,0.32)',
              }}
            />
            <span
              className="pointer-events-none absolute left-4 right-4 bottom-[11px] h-px"
              style={{
                background:
                  'linear-gradient(90deg, rgba(255,255,255,0) 0%, rgba(255,255,255,0.18) 42%, rgba(255,255,255,0) 100%)',
              }}
              aria-hidden
            />
            <span
              className="pointer-events-none absolute bottom-[7px] left-1/2 h-[7px] w-[7px] -translate-x-1/2 rounded-full"
              style={{ background: pnlColor, boxShadow: `0 0 12px ${pnlColor}` }}
              aria-hidden
            />
          </div>
        </div>

        {/* Stats */}
        <dl
          className="mt-[2.6%] grid w-fit gap-y-[0.45rem] tabular-nums"
          style={{
            gridTemplateColumns: 'auto auto',
            columnGap: 'clamp(28px, 3.4vw, 52px)',
            fontSize: 'clamp(11px, 1.5vw, 16px)',
          }}
        >
          <dt className="font-bold uppercase tracking-[0.18em] text-white/50">PNL</dt>
          <dd className="font-extrabold" style={{ color: pnlColor }}>
            {mainAmt}
            {pctStr ? <span className="ml-2 font-semibold text-white/50">({pctStr})</span> : null}
          </dd>
          {!overlay.compactStats ? (
            <>
              <dt className="font-bold uppercase tracking-[0.18em] text-white/50">
                {payload.statInvestedLabel ?? 'INVESTED'}
              </dt>
              <dd className="font-extrabold text-white/95">
                {payload.investedUsd == null ? '—' : formatCompactUsd(payload.investedUsd)}
              </dd>
              <dt className="font-bold uppercase tracking-[0.18em] text-white/50">
                {payload.statPositionLabel ?? 'POSITION'}
              </dt>
              <dd className="font-extrabold text-white/95">
                {payload.positionUsd == null ? '—' : formatCompactUsd(payload.positionUsd)}
              </dd>
            </>
          ) : null}
        </dl>

        <div className="flex-1" />

        {/* Footer */}
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-center gap-2" style={{ color: tone.tradeSub }}>
            <GlobeMark className="h-3.5 w-3.5 opacity-90" />
            <span className="text-[clamp(9px,1.2vw,12px)] font-bold uppercase tracking-[0.2em]">
              pointer.trade/{rawHandle.toLowerCase()}
            </span>
          </div>
          {overlay.showBranding ? (
            <span
              className="font-bold"
              style={{
                color: tone.tradeSub,
                fontSize: 'clamp(18px, 2.5vw, 30px)',
                letterSpacing: '-0.01em',
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
