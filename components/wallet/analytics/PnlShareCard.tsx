'use client';

import { forwardRef, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { PointerPnLShareCard } from '@/components/wallet/analytics/pnl-share/PointerPnLShareCard';
import { BackgroundLayer } from '@/components/wallet/analytics/pnl-share/BackgroundLayer';
import { payloadToShareCardData } from '@/lib/share/pnlShareCardData';
import { PNL_SHARE_CARD_REF } from '@/lib/share/pnlShareLayout';
import type { PnlSharePayload, ShareOverlaySettings, ShareBackgroundPresetId } from '@/lib/share/types';
import type { PnlMomentBasis } from '@/components/wallet/analytics/PnlMomentAmount';
import { cn } from '@/lib/utils/cn';

/**
 * Map a −50..50 pan to a translate% clamped to the zoom overflow, so an
 * object-cover video never pans off into black. At zoom 1 there's no overflow, so
 * pan does nothing (matches the video exporter's clamped cover math).
 */
function coverPanPct(pan: number, zoom: number): number {
  const max = Math.max(0, (zoom - 1) / 2) * 100;
  return (Math.max(-50, Math.min(50, pan)) / 50) * max;
}

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
    referralCode?: string | null;
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

  const previewRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const fitScale = useCardFitScale(previewRef);
  const showCustomMedia = Boolean(customImageSrc || videoSrc);

  const cardData = payloadToShareCardData({
    payload,
    overlay,
    backgroundId,
    amountPrimary,
    referralCode,
    chainTicker,
    solUsd,
    shareKind,
    shareHeader,
  });

  const setCanvasRef = (node: HTMLDivElement | null) => {
    canvasRef.current = node;
    if (typeof ref === 'function') ref(node);
    else if (ref) ref.current = node;
  };

  return (
    <div
      ref={previewRef}
      className={cn('relative aspect-video w-full bg-black', className)}
    >
      <div
        ref={setCanvasRef}
        data-pnl-share-canvas
        className="absolute left-0 top-0 origin-top-left overflow-visible"
        style={{
          width: PNL_SHARE_CARD_REF.w,
          height: PNL_SHARE_CARD_REF.h,
          transform: `scale(${fitScale})`,
        }}
      >
        {videoSrc ? (
          <div className="absolute inset-0 z-0 overflow-hidden">
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
                transform: `translate(${coverPanPct(videoPan.x, videoZoom)}%, ${coverPanPct(videoPan.y, videoZoom)}%) scale(${videoZoom})`,
                transformOrigin: 'center center',
              }}
            />
          </div>
        ) : null}

        {customImageSrc && !videoSrc ? (
          <div className="absolute inset-0 z-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={customImageSrc}
              alt=""
              className="h-full w-full object-cover"
              style={{
                transform: `translate(${coverPanPct(imagePan.x, imageZoom)}%, ${coverPanPct(imagePan.y, imageZoom)}%) scale(${imageZoom})`,
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
