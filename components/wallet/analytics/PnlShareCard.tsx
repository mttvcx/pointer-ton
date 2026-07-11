'use client';

import { forwardRef, useEffect, useLayoutEffect, useRef, useState, type RefObject } from 'react';
import { PointerPnLShareCard } from '@/components/wallet/analytics/pnl-share/PointerPnLShareCard';
import { BackgroundLayer } from '@/components/wallet/analytics/pnl-share/BackgroundLayer';
import { payloadToShareCardData } from '@/lib/share/pnlShareCardData';
import { PNL_SHARE_CARD_REF } from '@/lib/share/pnlShareLayout';
import type { PnlSharePayload, ShareOverlaySettings, ShareBackgroundPresetId } from '@/lib/share/types';
import type { PnlMomentBasis } from '@/components/wallet/analytics/PnlMomentAmount';
import { cn } from '@/lib/utils/cn';

type CoverBox = { left: number; top: number; width: number; height: number };

/**
 * Position media (its NATURAL w×h) to cover the card, scaled by zoom and offset by
 * pan (−50..50), clamped so it always fills the frame — you can pan within the
 * object-cover crop (aspect mismatch) AND the zoom overflow, never revealing black.
 * Mirrors the video exporter's cover math, so the preview == the export.
 */
function coverLayout(
  media: { w: number; h: number } | null,
  cardW: number,
  cardH: number,
  pan: { x: number; y: number },
  zoom: number,
): CoverBox {
  if (!media || media.w < 2 || media.h < 2) return { left: 0, top: 0, width: cardW, height: cardH };
  const z = Math.max(1, Math.min(4, zoom || 1));
  const coverScale = Math.max(cardW / media.w, cardH / media.h) * z;
  const width = media.w * coverScale;
  const height = media.h * coverScale;
  const overflowX = Math.max(0, (width - cardW) / 2);
  const overflowY = Math.max(0, (height - cardH) / 2);
  const clamp = (v: number) => Math.max(-50, Math.min(50, v));
  return {
    left: (cardW - width) / 2 + (clamp(pan.x) / 50) * overflowX,
    top: (cardH - height) / 2 + (clamp(pan.y) / 50) * overflowY,
    width,
    height,
  };
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
    /** When set, the media background is drag-to-reposition (composer only). */
    onPanChange?: (pan: { x: number; y: number }) => void;
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
    onPanChange,
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

  // Natural media size → cover-positioned so panning has real crop to move within.
  const [mediaDim, setMediaDim] = useState<{ w: number; h: number } | null>(null);
  useEffect(() => setMediaDim(null), [videoSrc, customImageSrc]);
  const activePan = videoSrc ? videoPan : imagePan;
  const activeZoom = videoSrc ? videoZoom : imageZoom;
  const box = coverLayout(mediaDim, PNL_SHARE_CARD_REF.w, PNL_SHARE_CARD_REF.h, activePan, activeZoom);
  const overflowX = Math.max(0, (box.width - PNL_SHARE_CARD_REF.w) / 2);
  const overflowY = Math.max(0, (box.height - PNL_SHARE_CARD_REF.h) / 2);
  const mediaStyle = { left: box.left, top: box.top, width: box.width, height: box.height } as const;

  // Grab-and-drag reposition (composer only). Screen delta → card px (÷fitScale) →
  // pan units (÷overflow ×50), clamped to ±50 so you can't drag into black.
  const drag = useRef<{ sx: number; sy: number; px: number; py: number } | null>(null);
  const onDragDown = (e: React.PointerEvent) => {
    if (!onPanChange) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    drag.current = { sx: e.clientX, sy: e.clientY, px: activePan.x, py: activePan.y };
  };
  const onDragMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d || !onPanChange) return;
    const s = fitScale || 1;
    const nx = overflowX > 0.5 ? d.px + ((e.clientX - d.sx) / s / overflowX) * 50 : d.px;
    const ny = overflowY > 0.5 ? d.py + ((e.clientY - d.sy) / s / overflowY) * 50 : d.py;
    onPanChange({ x: Math.max(-50, Math.min(50, nx)), y: Math.max(-50, Math.min(50, ny)) });
  };
  const onDragUp = () => {
    drag.current = null;
  };

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
              className="absolute max-w-none object-cover"
              src={videoSrc}
              muted={videoMuted}
              playsInline
              loop
              autoPlay={!videoPaused}
              preload="metadata"
              onLoadedMetadata={(e) => setMediaDim({ w: e.currentTarget.videoWidth, h: e.currentTarget.videoHeight })}
              style={mediaStyle}
            />
          </div>
        ) : null}

        {customImageSrc && !videoSrc ? (
          <div className="absolute inset-0 z-0 overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={customImageSrc}
              alt=""
              className="absolute max-w-none object-cover"
              draggable={false}
              onLoad={(e) => setMediaDim({ w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })}
              style={mediaStyle}
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

        {onPanChange && showCustomMedia ? (
          <div
            data-pnl-drag="1"
            className="absolute inset-0 z-[6] touch-none select-none"
            style={{ cursor: drag.current ? 'grabbing' : 'grab' }}
            onPointerDown={onDragDown}
            onPointerMove={onDragMove}
            onPointerUp={onDragUp}
            onPointerCancel={onDragUp}
          />
        ) : null}
      </div>
    </div>
  );
});

PnlShareCard.displayName = 'PnlShareCard';
