'use client';

import { forwardRef, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { PointerPnLShareCard } from '@/components/wallet/analytics/pnl-share/PointerPnLShareCard';
import { BackgroundLayer } from '@/components/wallet/analytics/pnl-share/BackgroundLayer';
import { payloadToShareCardData } from '@/lib/share/pnlShareCardData';
import { PNL_SHARE_CARD_REF } from '@/lib/share/pnlShareLayout';
import type { PnlSharePayload, ShareOverlaySettings, ShareBackgroundPresetId } from '@/lib/share/types';
import type { PnlMomentBasis } from '@/components/wallet/analytics/PnlMomentAmount';
import { cn } from '@/lib/utils/cn';

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
    chainTicker?: 'SOL' | 'USD';
    solUsd?: number | null;
    shareKind?: 'position' | 'monthly';
    shareHeader?: string | null;
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
    headlineText,
    referralCode,
    className,
    chainTicker = 'USD',
    solUsd,
    shareKind = 'position',
    shareHeader,
    amountMotionBasis,
    amountMotionFrozen = false,
    amountRevealKey,
  } = props;

  const outerRef = useRef<HTMLDivElement | null>(null);
  const fitScale = useCardFitScale(outerRef);
  const showCustomMedia = Boolean(customImageSrc || videoSrc);

  const cardData = payloadToShareCardData({
    payload,
    overlay,
    backgroundId,
    amountPrimary,
    referralCode,
    headlineText,
    chainTicker,
    solUsd,
    shareKind,
    shareHeader,
  });

  const setRefs = (node: HTMLDivElement | null) => {
    outerRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  return (
    <div
      ref={setRefs}
      className={cn('relative aspect-video w-full overflow-hidden rounded-[10px] bg-black', className)}
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

        <BackgroundLayer
          theme={backgroundId}
          hasCustomMedia={showCustomMedia}
          overlayOpacity={overlay.overlayOpacity}
          className="z-[1]"
        />

        <PointerPnLShareCard
          data={cardData}
          scale={1}
          textScale={overlay.textScale}
          calendarMonthLabel={shareKind === 'monthly' ? shareHeader : null}
          statBoughtLabel={payload.statInvestedLabel ?? 'Total Bought'}
          statSoldLabel={payload.statPositionLabel ?? 'Total Sold'}
          showCashbackFooter={overlay.showCashbackFooter}
          motionBasis={amountMotionBasis}
          motionFrozen={amountMotionFrozen}
          motionRevealKey={amountRevealKey}
          className="z-[2]"
        />
      </div>
    </div>
  );
});

PnlShareCard.displayName = 'PnlShareCard';
