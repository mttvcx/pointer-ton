'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownUp,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  Pause,
  Play,
  Trash2,
  Video as VideoIcon,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { PnlShareCard } from '@/components/wallet/analytics/PnlShareCard';
import type { PnlMomentBasis } from '@/components/wallet/analytics/PnlMomentAmount';
import { ShareBackgroundPicker } from '@/components/wallet/analytics/ShareBackgroundPicker';
import { ShareBackgroundPositionControls } from '@/components/wallet/analytics/ShareBackgroundPositionControls';
import { ShareCustomizePanel } from '@/components/wallet/analytics/ShareCustomizePanel';
import { copyShareImagePng, exportShareImagePng } from '@/lib/share/exportShareImage';
import { exportShareVideoWebm } from '@/lib/share/exportShareVideo';
import { IDB_IMAGE_KEY, IDB_VIDEO_KEY } from '@/lib/share/sharePersistenceKeys';
import {
  SHARE_VIDEO_MAX_BYTES,
  SHARE_VIDEO_MAX_DURATION_SEC,
  SHARE_IMAGE_MAX_BYTES,
} from '@/lib/share/types';
import { accentHex as pickAccentHex } from '@/lib/share/accentTokens';
import { sharePeriodHeadline } from '@/lib/share/pnlShareFormat';
import { formatShareSolAmount, formatShareUsdAmount } from '@/lib/share/pnlShareFormat';
import { idbDeleteBlob, idbGetBlob, idbPutBlob } from '@/lib/share/localMediaDb';
import { shortenAddress, SOL_MINT } from '@/lib/utils/addresses';
import { useShareComposerState } from '@/hooks/useShareComposerState';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useWalletIntelStore } from '@/store/walletIntelStore';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import {
  modalBtnPrimaryClass,
  modalBtnSecondaryClass,
  modalCloseBtnClass,
} from '@/lib/ui/modalChrome';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { cn } from '@/lib/utils/cn';

const TOOL_BTN =
  'inline-flex h-8 items-center gap-1.5 rounded-sm border border-border-subtle bg-bg-sunken px-2.5 text-[11px] font-medium text-fg-secondary transition hover:bg-bg-hover hover:text-fg-primary disabled:opacity-45';

function filenameBase(token: string, wallet: string) {
  const ts = Date.now();
  const short = shortenAddress(wallet, 4).replace(/\u2026/g, '-');
  const safeTok = token.replace(/[^\w.-]+/g, '').slice(0, 12) || 'token';
  return `pointer-pnl-${safeTok}-${short}-${ts}`;
}

export function PnlShareComposer() {
  const open = useWalletIntelStore((s) => s.shareOpen);
  const shareKind = useWalletIntelStore((s) => s.shareKind);
  const shareHeader = useWalletIntelStore((s) => s.shareHeader);
  const shareCalendarCurrency = useWalletIntelStore((s) => s.shareCalendarCurrency);
  const payload = useWalletIntelStore((s) => s.sharePayload);
  const close = useWalletIntelStore((s) => s.closeShare);

  const [payloadSnapshot, setPayloadSnapshot] = useState(payload);
  useEffect(() => {
    if (payload) setPayloadSnapshot(payload);
  }, [payload]);

  const displayPayloadStable = payload ?? payloadSnapshot;
  const { mounted: overlayMounted, visible: overlayVisible } = useOverlayPresence(
    Boolean(open && displayPayloadStable),
  );

  const cardRef = useRef<HTMLDivElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const videoExportRef = useRef<HTMLVideoElement>(null);

  const composer = useShareComposerState();
  const { authenticated, getAccessToken } = usePointerAuth();

  useEffect(() => {
    if (!open || shareKind !== 'monthly' || !shareCalendarCurrency) return;
    composer.setChainTicker(shareCalendarCurrency === 'sol' ? 'SOL' : 'USD');
  }, [open, shareKind, shareCalendarCurrency, composer.setChainTicker]);
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<'png' | 'copy' | 'video' | null>(null);
  const [videoProg, setVideoProg] = useState(0);
  const [videoMuted, setVideoMuted] = useState(false);
  const [videoPlaying, setVideoPlaying] = useState(false);

  const solUsdQ = useQuery({
    queryKey: ['sol-usd-spot-share', SOL_MINT],
    queryFn: async () => {
      const res = await fetch(`/api/prices/mint?mint=${encodeURIComponent(SOL_MINT)}`);
      if (!res.ok) throw new Error('sol_px');
      const j = (await res.json()) as { usdPrice?: number | null };
      const px = j.usdPrice;
      return typeof px === 'number' && Number.isFinite(px) ? px : null;
    },
    staleTime: 60_000,
  });

  const referralQ = useQuery({
    queryKey: ['referral-code', 'share-composer'],
    enabled: Boolean(open && authenticated),
    queryFn: async () => {
      const token = await getAccessToken();
      if (!token) return null;
      const res = await fetch('/api/referrals/code', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return null;
      return res.json() as Promise<{ code?: string | null }>;
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    const revoked: string[] = [];
    (async () => {
      const imgBuf = await idbGetBlob(IDB_IMAGE_KEY);
      const vidBuf = await idbGetBlob(IDB_VIDEO_KEY);
      if (imgBuf) {
        const blob = new Blob([imgBuf], { type: 'image/jpeg' });
        const url = URL.createObjectURL(blob);
        revoked.push(url);
        setCustomImageUrl(url);
      }
      if (vidBuf) {
        const blob = new Blob([vidBuf], { type: 'video/mp4' });
        const url = URL.createObjectURL(blob);
        revoked.push(url);
        setCustomVideoUrl(url);
      }
    })().catch(() => {});
    return () => {
      revoked.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const v = videoPreviewRef.current;
    if (!v || !customVideoUrl) return;
    if (composer.mode !== 'video') return;
    v.muted = videoMuted;
    v.pause();
  }, [open, composer.mode, customVideoUrl, videoMuted]);

  useEffect(() => {
    const v = videoPreviewRef.current;
    if (!v) return;
    const onPlay = () => setVideoPlaying(true);
    const onPause = () => setVideoPlaying(false);
    v.addEventListener('play', onPlay);
    v.addEventListener('pause', onPause);
    return () => {
      v.removeEventListener('play', onPlay);
      v.removeEventListener('pause', onPause);
    };
  }, [customVideoUrl, composer.mode]);

  const onPickImage = useCallback(
    async (file: File) => {
      if (file.size > SHARE_IMAGE_MAX_BYTES) {
        toast.error(`Image too large (max ${SHARE_IMAGE_MAX_BYTES / (1024 * 1024)}MB)`);
        return;
      }
      const buf = await file.arrayBuffer();
      await idbPutBlob(IDB_IMAGE_KEY, buf);
      const blob = new Blob([buf], { type: file.type });
      const url = URL.createObjectURL(blob);
      setCustomImageUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return url;
      });
      toast.success('Custom image saved locally');
    },
    [],
  );

  const onPickVideo = useCallback(async (file: File) => {
    if (file.size > SHARE_VIDEO_MAX_BYTES) {
      toast.error(`Video too large (max ${SHARE_VIDEO_MAX_BYTES / (1024 * 1024)}MB)`);
      return;
    }
    const buf = await file.arrayBuffer();
    await idbPutBlob(IDB_VIDEO_KEY, buf);
    const blob = new Blob([buf], { type: file.type || 'video/mp4' });
    const url = URL.createObjectURL(blob);
    setCustomVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return url;
    });
    composer.setMode('video');
    toast.success('Video saved — will autoplay when you open Video mode');
  }, [composer]);

  const clearVideo = useCallback(async () => {
    await idbDeleteBlob(IDB_VIDEO_KEY).catch(() => {});
    setCustomVideoUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    toast.message('Video background removed');
  }, []);

  const seekPreviewVideo = useCallback((time: number) => {
    const el = videoPreviewRef.current;
    if (!el) return;
    el.currentTime = time;
  }, []);

  const toggleVideoPlay = useCallback(() => {
    const el = videoPreviewRef.current;
    if (!el) return;
    if (el.paused) {
      el.muted = videoMuted;
      const p = el.play();
      if (p && typeof p.catch === 'function') void p.catch(() => {});
    } else {
      el.pause();
    }
  }, [videoMuted]);

  const toggleVideoMuted = useCallback(() => {
    setVideoMuted((nextMuted) => {
      const next = !nextMuted;
      const el = videoPreviewRef.current;
      if (el) el.muted = next;
      return next;
    });
  }, []);

  function amountPrimaryText(): string | null {
    const p = displayPayloadStable;
    if (!p) return null;
    if (composer.chainTicker === 'SOL' && solUsdQ.data != null && p.pnlUsd != null) {
      return formatShareSolAmount(p.pnlUsd / solUsdQ.data);
    }
    if (p.pnlUsd == null) return null;
    return formatShareUsdAmount(p.pnlUsd);
  }

  const shareAmountMotionBasis: PnlMomentBasis | null =
    !displayPayloadStable || displayPayloadStable.pnlUsd == null || !Number.isFinite(displayPayloadStable.pnlUsd)
      ? null
      : composer.chainTicker === 'SOL' && solUsdQ.data != null && solUsdQ.data > 0
        ? { kind: 'sol', value: displayPayloadStable.pnlUsd / solUsdQ.data }
        : { kind: 'usd', value: displayPayloadStable.pnlUsd };

  const shareAmountRevealKey = displayPayloadStable
    ? shareKind === 'monthly' && shareHeader
      ? `${shareHeader}|${composer.chainTicker}|${displayPayloadStable.pnlUsd ?? ''}`
      : `${displayPayloadStable.walletAddress}|${displayPayloadStable.tokenTicker}|${composer.chainTicker}|${displayPayloadStable.pnlUsd ?? ''}`
    : '';

  const pngExportBg =
    (composer.mode === 'video' && customVideoUrl) || (composer.mode === 'image' && customImageUrl)
      ? null
      : '#000000';

  const onDownloadPng = async () => {
    const p = displayPayloadStable;
    if (!cardRef.current || !p) return;
    setBusy('png');
    try {
      await exportShareImagePng(
        cardRef.current,
        shareKind === 'monthly' && shareHeader
          ? `pointer-monthly-pnl-${shareHeader.replace(/\s+/g, '-').toLowerCase()}.png`
          : `${filenameBase(p.tokenTicker, p.walletAddress)}.png`,
        { backgroundColor: pngExportBg },
      );
      toast.success('PNG downloaded');
    } catch {
      toast.error('Could not export image');
    } finally {
      setBusy(null);
    }
  };

  const onCopyPng = async () => {
    if (!cardRef.current) return;
    setBusy('copy');
    try {
      const ok = await copyShareImagePng(cardRef.current, { backgroundColor: pngExportBg });
      if (ok) toast.success('Image copied');
      else {
        toast.error('Clipboard not supported — use Download');
      }
    } finally {
      setBusy(null);
    }
  };

  const onExportVideo = async () => {
    const p = displayPayloadStable;
    if (!p || !customVideoUrl) {
      toast.error('Add a video background first');
      return;
    }
    const vid = videoExportRef.current;
    if (!vid) return;
    vid.src = customVideoUrl;
    vid.preload = 'auto';
    vid.muted = videoMuted;
    vid.loop = false;
    setBusy('video');
    setVideoProg(0);
    try {
      await new Promise<void>((r, j) => {
        vid.onloadedmetadata = () => r();
        vid.onerror = () => j(new Error('video_load'));
      });
      const blob = await exportShareVideoWebm({
        videoEl: vid,
        width: 1920,
        height: 1080,
        overlay: composer.overlay,
        cardArgs: {
          ticker: p.tokenTicker,
          tokenName: p.tokenName,
          pnlUsd: p.pnlUsd,
          pnlPct: p.pnlPct,
          investedUsd: p.investedUsd,
          positionUsd: p.positionUsd,
          walletLabel: p.walletLabel,
          walletAddress: p.walletAddress,
          accentHex: pickAccentHex(composer.overlay.accent),
          chainTicker: composer.chainTicker,
          amountPrimary: amountPrimaryText(),
          referralCode: referralQ.data?.code ?? null,
          backgroundId: composer.backgroundId,
          momentBasis: shareAmountMotionBasis,
          periodLabel: sharePeriodHeadline(shareKind, shareHeader, p.timeframe),
          statBoughtLabel: p.statInvestedLabel ?? 'Total Bought',
          statSoldLabel: p.statPositionLabel ?? 'Total Sold',
          shareKind,
          shareHeader,
          timeframe: p.timeframe,
        },
        maxDurationSec: SHARE_VIDEO_MAX_DURATION_SEC,
        videoPan: composer.videoPan,
        videoZoom: composer.videoZoom,
        muted: videoMuted,
        onProgress: (p) => setVideoProg(p),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
      a.download = `${filenameBase(p.tokenTicker, p.walletAddress)}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`${ext.toUpperCase()} downloaded`);
    } catch {
      toast.error('Video export failed — try a shorter clip');
    } finally {
      setBusy(null);
      setVideoProg(0);
    }
  };

  const toggleChain = () => {
    composer.setChainTicker(composer.chainTicker === 'SOL' ? 'USD' : 'SOL');
  };

  if (!overlayMounted || !displayPayloadStable) return null;
  const d = displayPayloadStable;

  const showVideoBg = composer.mode === 'video' && customVideoUrl;
  const showImageBg = composer.mode === 'image' && customImageUrl;
  const hasCalendarData = Boolean(d.calendarDays && d.calendarDays.length > 0);
  const hasUploadedMedia = Boolean(showVideoBg || showImageBg);

  return (
    <div className="fixed inset-0 z-[570] flex items-center justify-center p-3 sm:p-5">
      <button
        type="button"
        className={cn(
          'absolute inset-0 cursor-default bg-black/40 backdrop-blur-[3px]',
          overlayBackdropClasses(overlayVisible),
          'fill-mode-forwards',
        )}
        onClick={() => close()}
        aria-label="Close share composer"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="pnl-share-title"
        className={cn(
          'relative z-10 flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-xl border border-white/[0.08] bg-[#080a0e]/90 fill-mode-forwards shadow-2xl backdrop-blur-xl',
          overlayPanelClasses(overlayVisible),
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-4 py-3 sm:px-5">
          <div className="min-w-0">
            <h2 id="pnl-share-title" className="text-[14px] font-medium text-fg-primary">
              {shareKind === 'monthly' ? 'Share monthly PNL' : 'Share PNL'}
            </h2>
            <p className="mt-0.5 truncate text-[12px] text-fg-muted">
              {shareKind === 'monthly' && shareHeader
                ? shareHeader
                : `${d.tokenTicker} · ${shortenAddress(d.walletAddress, 5)}`}
            </p>
          </div>
          <button type="button" onClick={() => close()} className={modalCloseBtnClass} aria-label="Close">
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4 sm:px-5">
          <div className="overflow-hidden">
            <PnlShareCard
                ref={cardRef}
                payload={d}
                overlay={composer.overlay}
                backgroundId={composer.backgroundId}
                customImageSrc={showImageBg ? customImageUrl : null}
                imagePan={composer.imagePan}
                imageZoom={composer.imageZoom}
                amountPrimary={amountPrimaryText()}
                videoSrc={showVideoBg ? customVideoUrl : null}
                videoRef={videoPreviewRef}
                videoPan={composer.videoPan}
                videoZoom={composer.videoZoom}
                videoMuted={videoMuted}
                videoPaused
                referralCode={referralQ.data?.code ?? null}
                amountMotionBasis={shareAmountMotionBasis}
                amountMotionFrozen={busy === 'png' || busy === 'copy'}
                amountRevealKey={shareAmountRevealKey}
                chainTicker={composer.chainTicker as 'SOL' | 'USD'}
                solUsd={solUsdQ.data ?? null}
                shareKind={shareKind}
                shareHeader={shareHeader}
              />
          </div>
          <video
            ref={videoExportRef}
            className="pointer-events-none fixed left-[-10000px] top-0 h-[1080px] w-[1920px] max-w-none opacity-0"
            width={1920}
            height={1080}
            playsInline
            preload="auto"
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="inline-flex rounded-sm border border-border-subtle bg-bg-sunken p-0.5">
              <button
                type="button"
                onClick={() => composer.setMode('image')}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-[11px] font-medium transition',
                  composer.mode === 'image'
                    ? 'bg-bg-hover text-fg-primary'
                    : 'text-fg-muted hover:text-fg-secondary',
                )}
              >
                <ImageIcon className="h-3.5 w-3.5" strokeWidth={2} />
                Image
              </button>
              <button
                type="button"
                onClick={() => composer.setMode('video')}
                className={cn(
                  'inline-flex h-7 items-center gap-1.5 rounded-sm px-2.5 text-[11px] font-medium transition',
                  composer.mode === 'video'
                    ? 'bg-bg-hover text-fg-primary'
                    : 'text-fg-muted hover:text-fg-secondary',
                )}
              >
                <VideoIcon className="h-3.5 w-3.5" strokeWidth={2} />
                Video
              </button>
            </div>
            <button type="button" onClick={toggleChain} className={TOOL_BTN}>
              <ArrowDownUp className="h-3.5 w-3.5" strokeWidth={2} />
              {composer.chainTicker}
            </button>
          </div>

          {composer.mode === 'image' ? (
            <ShareBackgroundPicker
              selectedId={composer.backgroundId}
              onSelect={composer.setBackgroundId}
              onPickImageFile={(f) => void onPickImage(f)}
              disabled={Boolean(busy)}
            />
          ) : (
            <div className="space-y-3 rounded-md border border-border-subtle bg-bg-sunken p-3">
              <div className="flex flex-wrap items-center gap-2">
                <label className={cn(TOOL_BTN, 'cursor-pointer')}>
                  Upload video
                  <input
                    type="file"
                    accept="video/mp4,video/webm,video/quicktime"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      e.target.value = '';
                      if (f) void onPickVideo(f);
                    }}
                  />
                </label>
                {customVideoUrl ? (
                  <button type="button" onClick={() => void clearVideo()} className={TOOL_BTN}>
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    Remove
                  </button>
                ) : null}
              </div>
              {customVideoUrl ? (
                <div className="space-y-3 border-t border-border-subtle pt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <button type="button" onClick={toggleVideoPlay} className={TOOL_BTN}>
                      {videoPlaying ? (
                        <Pause className="h-3.5 w-3.5" strokeWidth={2} />
                      ) : (
                        <Play className="h-3.5 w-3.5" strokeWidth={2} />
                      )}
                      {videoPlaying ? 'Pause' : 'Play'}
                    </button>
                    <button type="button" onClick={toggleVideoMuted} className={TOOL_BTN}>
                      {videoMuted ? (
                        <VolumeX className="h-3.5 w-3.5" strokeWidth={2} />
                      ) : (
                        <Volume2 className="h-3.5 w-3.5" strokeWidth={2} />
                      )}
                      {videoMuted ? 'Muted' : 'Sound'}
                    </button>
                  </div>
                  <VideoScrubber video={videoPreviewRef} onSeek={seekPreviewVideo} />
                </div>
              ) : (
                <p className="text-[11px] text-fg-muted">
                  MP4 or WebM, up to {(SHARE_VIDEO_MAX_BYTES / (1024 * 1024)).toFixed(0)}MB ·{' '}
                  {SHARE_VIDEO_MAX_DURATION_SEC}s max. Saved on this device.
                </p>
              )}
            </div>
          )}

          {hasUploadedMedia ? (
            <ShareBackgroundPositionControls
              pan={composer.mode === 'video' ? composer.videoPan : composer.imagePan}
              zoom={composer.mode === 'video' ? composer.videoZoom : composer.imageZoom}
              onPan={(pan) =>
                composer.mode === 'video' ? composer.setVideoPan(pan) : composer.setImagePan(pan)
              }
              onZoom={(zoom) =>
                composer.mode === 'video' ? composer.setVideoZoom(zoom) : composer.setImageZoom(zoom)
              }
              onReset={() => {
                if (composer.mode === 'video') {
                  composer.setVideoPan({ x: 0, y: 0 });
                  composer.setVideoZoom(1);
                } else {
                  composer.setImagePan({ x: 0, y: 0 });
                  composer.setImageZoom(1);
                }
              }}
            />
          ) : null}

          <div className="rounded-md border border-border-subtle bg-bg-sunken p-3">
            <ShareCustomizePanel
              overlay={composer.overlay}
              onChange={composer.patchOverlay}
              onReset={composer.resetDefaults}
              hasCalendarData={hasCalendarData}
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border-subtle bg-bg-raised px-4 py-3 sm:px-5">
          <button
            type="button"
            onClick={() => void onCopyPng()}
            disabled={busy !== null || composer.mode === 'video'}
            className={cn(modalBtnSecondaryClass, 'inline-flex h-9 shrink-0 items-center gap-1.5 px-4 text-[12px]')}
          >
            {busy === 'copy' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Copy className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            Copy image
          </button>
          <button
            type="button"
            onClick={() =>
              composer.mode === 'video' ? void onExportVideo() : void onDownloadPng()
            }
            disabled={busy !== null || (composer.mode === 'video' && !customVideoUrl)}
            className={cn(modalBtnPrimaryClass, 'inline-flex h-9 shrink-0 items-center gap-1.5 px-4 text-[12px]')}
          >
            {busy === 'png' || busy === 'video' ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Download className="h-3.5 w-3.5" strokeWidth={2} />
            )}
            {busy === 'video'
              ? `Exporting ${videoProg}%`
              : composer.mode === 'video'
                ? 'Download video'
                : 'Download PNG'}
          </button>
        </div>
      </div>
    </div>
  );
}

function VideoScrubber({
  video,
  onSeek,
}: {
  video: RefObject<HTMLVideoElement | null>;
  onSeek: (time: number) => void;
}) {
  const [t, setT] = useState(0);
  const [d, setD] = useState(0);
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    const onTime = () => setT(el.currentTime);
    const onMeta = () => setD(el.duration || 0);
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
    };
  }, [video]);

  const fmt = (x: number) => {
    if (!Number.isFinite(x)) return '0:00';
    const m = Math.floor(x / 60);
    const s = Math.floor(x % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  return (
    <div className="flex items-center gap-3 text-[11px] tabular-nums text-fg-muted">
      <span className="w-[74px] shrink-0">
        {fmt(t)} / {fmt(d)}
      </span>
      <input
        type="range"
        min={0}
        max={d || 1}
        step={0.01}
        value={t}
        onChange={(e) => {
          onSeek(Number(e.target.value));
        }}
        className="h-1 flex-1 accent-accent-primary"
      />
    </div>
  );
}
