'use client';

import { forwardRef, useLayoutEffect, useRef, useState, type CSSProperties, type RefObject } from 'react';
import { cn } from '@/lib/utils/cn';
import type { PnlSharePayload } from '@/lib/share/types';
import type { ShareOverlaySettings } from '@/lib/share/types';
import type { ShareBackgroundPresetId } from '@/lib/share/types';
import {
  DEFAULT_SHARE_HEADLINE,
  MAX_SHARE_HEADLINE_CHARS,
} from '@/lib/share/types';
import { formatCompactUsd } from '@/lib/utils/formatters';
import {
  PNL_SHARE_COVER,
  PNL_SHARE_CARD_REF,
  PNL_SHARE_POS,
} from '@/lib/share/pnlShareLayout';
import {
  PNL_SHARE_NEG_COLOR,
  PNL_SHARE_POS_COLOR,
  shareCardTheme,
} from '@/lib/share/shareCardTheme';
import {
  PnlMomentAmount,
  type PnlMomentBasis,
} from '@/components/wallet/analytics/PnlMomentAmount';
import { PnlShareCardChrome } from '@/components/wallet/analytics/PnlShareCardChrome';

function useCardFitScale(outerRef: RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const update = () => {
      const w = el.clientWidth;
      if (w > 0) setScale(w / PNL_SHARE_CARD_REF.w);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [outerRef]);
  return scale;
}

function CoverPatch({
  box,
  scale,
}: {
  box: (typeof PNL_SHARE_COVER)[keyof typeof PNL_SHARE_COVER];
  scale: number;
}) {
  return (
    <div
      className="pointer-events-none absolute z-[2]"
      style={{
        left: box.x * scale,
        top: box.y * scale,
        width: box.w * scale,
        height: box.h * scale,
        background: box.color,
      }}
    />
  );
}

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
>(function PnlShareCard(props, ref) {
  const {
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
  } = props;

  const outerRef = useRef<HTMLDivElement | null>(null);
  const fitScale = useCardFitScale(outerRef);
  const theme = shareCardTheme(backgroundId);

  const pos = payload.pnlUsd != null && payload.pnlUsd >= 0;
  const pnlColor = pos ? PNL_SHARE_POS_COLOR : PNL_SHARE_NEG_COLOR;

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
  const useReferenceScene = !showCustomMedia;

  const setRefs = (node: HTMLDivElement | null) => {
    outerRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  const s = fitScale * overlay.textScale;
  const abs = (x: number, y: number): CSSProperties => ({
    position: 'absolute',
    left: x * fitScale,
    top: y * fitScale,
    transform: overlay.textScale !== 1 ? `scale(${overlay.textScale})` : undefined,
    transformOrigin: 'top left',
  });

  return (
    <div
      ref={setRefs}
      className={cn('relative aspect-[3/2] w-full overflow-hidden rounded-[10px] bg-[#05000a]', className)}
    >
      <div
        className="absolute left-0 top-0 origin-top-left"
        style={{
          width: PNL_SHARE_CARD_REF.w,
          height: PNL_SHARE_CARD_REF.h,
          transform: `scale(${fitScale})`,
        }}
      >
        {videoSrc ? (
          <video
            ref={videoRef}
            className="absolute inset-0 z-0 h-full w-full object-cover"
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
          <div className="absolute inset-0 z-0 overflow-hidden">
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

        {useReferenceScene ? (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={theme.referenceImage}
            alt=""
            className="absolute inset-0 z-[1] h-full w-full object-cover"
            style={theme.imageFilter ? { filter: theme.imageFilter } : undefined}
            draggable={false}
          />
        ) : (
          <div
            className="absolute inset-0 z-[1]"
            style={{ background: `rgba(0,0,0,${Math.min(0.72, overlay.overlayOpacity)})` }}
          />
        )}

        {useReferenceScene ? (
          <>
            {overlay.showCashbackFooter ? <CoverPatch box={PNL_SHARE_COVER.headline} scale={1} /> : null}
            <CoverPatch box={PNL_SHARE_COVER.ticker} scale={1} />
            {overlay.showTokenName && tokenName ? <CoverPatch box={PNL_SHARE_COVER.tokenName} scale={1} /> : null}
            <CoverPatch box={PNL_SHARE_COVER.heroAmount} scale={1} />
            <CoverPatch box={PNL_SHARE_COVER.stats} scale={1} />
            <CoverPatch box={PNL_SHARE_COVER.footerUrl} scale={1} />
            {overlay.showBranding ? <CoverPatch box={PNL_SHARE_COVER.footerHandle} scale={1} /> : null}
          </>
        ) : (
          <PnlShareCardChrome backgroundId={backgroundId} className="z-[2]" />
        )}
      </div>

      {/* Live overlay — real-pixel space sibling of the scaled art so `abs()` (× fitScale)
          maps 1:1 onto the design-space cover patches. Nesting it inside the scaled
          container double-scaled every label (tiny text drifting to the corner). */}
      <div className="absolute inset-0 z-[3]">
          {overlay.showCashbackFooter && displayHeadline ? (
            <div
              style={{
                ...abs(PNL_SHARE_POS.headline.x, PNL_SHARE_POS.headline.y),
                maxWidth: PNL_SHARE_POS.headline.maxW * fitScale,
              }}
            >
              {editableHeadline ? (
                <input
                  value={headlineValue}
                  maxLength={MAX_SHARE_HEADLINE_CHARS}
                  onChange={(e) => onHeadlineChange?.(e.target.value)}
                  className="w-full bg-transparent text-[11px] font-bold uppercase tracking-[0.12em] text-white/90 outline-none"
                  aria-label="Edit share card headline"
                />
              ) : (
                <span className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/90">
                  {displayHeadline}
                </span>
              )}
            </div>
          ) : null}

          <h2
            className="font-black uppercase leading-none text-white"
            style={{
              ...abs(PNL_SHARE_POS.ticker.x, PNL_SHARE_POS.ticker.y),
              fontSize: PNL_SHARE_POS.ticker.fontSize * s,
              letterSpacing: '-0.025em',
            }}
          >
            {ticker}
          </h2>

          {overlay.showTokenName && tokenName ? (
            <p
              className="font-bold uppercase tracking-[0.2em]"
              style={{
                ...abs(PNL_SHARE_POS.tokenName.x, PNL_SHARE_POS.tokenName.y),
                color: theme.accent,
                fontSize: PNL_SHARE_POS.tokenName.fontSize * s,
              }}
            >
              {tokenName.slice(0, 28)}
            </p>
          ) : null}

          <PnlMomentAmount
            basis={motionBasis}
            fallbackText={mainAmt}
            frozen={amountMotionFrozen}
            revealKey={momentRevealKey}
            positive={pos}
            className="absolute font-black tabular-nums leading-none"
            style={{
              ...abs(PNL_SHARE_POS.heroAmount.x, PNL_SHARE_POS.heroAmount.y),
              color: pnlColor,
              fontSize: PNL_SHARE_POS.heroAmount.fontSize * s,
              letterSpacing: '-0.02em',
              textShadow: pos
                ? '0 0 32px rgba(34,238,179,0.38)'
                : '0 0 32px rgba(255,94,120,0.32)',
            }}
          />

          <div style={abs(PNL_SHARE_POS.stats.x, PNL_SHARE_POS.stats.y)}>
            <div
              className="grid tabular-nums"
              style={{
                gridTemplateColumns: 'auto auto',
                columnGap: PNL_SHARE_POS.stats.labelGap * s,
                fontSize: PNL_SHARE_POS.stats.fontSize * s,
                rowGap: 10 * s,
              }}
            >
              <span className="font-bold uppercase tracking-[0.18em] text-white/50">PNL</span>
              <span className="font-extrabold" style={{ color: pnlColor }}>
                {mainAmt}
                {pctStr ? <span className="ml-2 font-semibold text-white/50">({pctStr})</span> : null}
              </span>
              {!overlay.compactStats ? (
                <>
                  <span className="font-bold uppercase tracking-[0.18em] text-white/50">
                    {payload.statInvestedLabel ?? 'INVESTED'}
                  </span>
                  <span className="font-extrabold text-white/95">
                    {payload.investedUsd == null ? '—' : formatCompactUsd(payload.investedUsd)}
                  </span>
                  <span className="font-bold uppercase tracking-[0.18em] text-white/50">
                    {payload.statPositionLabel ?? 'POSITION'}
                  </span>
                  <span className="font-extrabold text-white/95">
                    {payload.positionUsd == null ? '—' : formatCompactUsd(payload.positionUsd)}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          <div
            className="flex items-center gap-2"
            style={{
              ...abs(PNL_SHARE_POS.footerUrl.x, PNL_SHARE_POS.footerUrl.y),
              color: theme.accentMuted,
              fontSize: PNL_SHARE_POS.footerUrl.fontSize * s,
            }}
          >
            <GlobeMark className="opacity-90" style={{ width: 14 * s, height: 14 * s }} />
            <span className="font-bold uppercase tracking-[0.2em]">
              pointer.trade/{rawHandle.toLowerCase()}
            </span>
          </div>

          {overlay.showBranding ? (
            <span
              className="absolute font-bold"
              style={{
                right: (PNL_SHARE_CARD_REF.w - PNL_SHARE_POS.footerHandle.x) * fitScale,
                top: PNL_SHARE_POS.footerHandle.y * fitScale,
                color: theme.accent,
                fontSize: PNL_SHARE_POS.footerHandle.fontSize * s,
                transform: overlay.textScale !== 1 ? `scale(${overlay.textScale})` : undefined,
                transformOrigin: 'top right',
              }}
            >
              {handle}
            </span>
          ) : null}
        </div>
    </div>
  );
});

PnlShareCard.displayName = 'PnlShareCard';

function GlobeMark({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3c2.6 3 4 6 4 9s-1.4 6-4 9c-2.6-3-4-6-4-9s1.4-6 4-9z" />
    </svg>
  );
}
