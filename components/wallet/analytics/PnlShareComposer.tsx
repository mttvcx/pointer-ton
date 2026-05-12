'use client';

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowDownUp,
  Copy,
  Download,
  Image as ImageIcon,
  Loader2,
  Paintbrush,
  Pause,
  Play,
  Settings2,
  Trash2,
  Video as VideoIcon,
  Volume2,
  VolumeX,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PnlShareCard } from '@/components/wallet/analytics/PnlShareCard';
import type { PnlMomentBasis } from '@/components/wallet/analytics/PnlMomentAmount';
import { ShareBackgroundPicker } from '@/components/wallet/analytics/ShareBackgroundPicker';
import { ShareCustomizePanel } from '@/components/wallet/analytics/ShareCustomizePanel';
import { copyShareImagePng, exportShareImagePng } from '@/lib/share/exportShareImage';
import { exportShareVideoWebm } from '@/lib/share/exportShareVideo';
import { IDB_IMAGE_KEY, IDB_VIDEO_KEY } from '@/lib/share/sharePersistenceKeys';
import {
  SHARE_VIDEO_MAX_BYTES,
  SHARE_VIDEO_MAX_DURATION_SEC,
  SHARE_IMAGE_MAX_BYTES,
} from '@/lib/share/types';
import { accentHex as pickAccentHex } from '@/lib/share/videoCanvasFrame';
import { formatCompactUsd } from '@/lib/utils/formatters';
import { idbDeleteBlob, idbGetBlob, idbPutBlob } from '@/lib/share/localMediaDb';
import { shortenAddress, SOL_MINT } from '@/lib/utils/addresses';
import { useShareComposerState } from '@/hooks/useShareComposerState';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { useWalletIntelStore } from '@/store/walletIntelStore';
import { useOverlayPresence } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { cn } from '@/lib/utils/cn';

function filenameBase(token: string, wallet: string) {
  const ts = Date.now();
  const short = shortenAddress(wallet, 4).replace(/\u2026/g, '-');
  const safeTok = token.replace(/[^\w.-]+/g, '').slice(0, 12) || 'token';
  return `pointer-pnl-${safeTok}-${short}-${ts}`;
}

export function PnlShareComposer() {
  const open = useWalletIntelStore((s) => s.shareOpen);
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
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<'png' | 'copy' | 'video' | null>(null);
  const [showCustomize, setShowCustomize] = useState(false);
  const [videoProg, setVideoProg] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);
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
      const sol = p.pnlUsd / solUsdQ.data;
      const sign = sol >= 0 ? '+' : '-';
      return `${sign}${Math.abs(sol).toFixed(3)} SOL`;
    }
    if (p.pnlUsd == null) return null;
    return p.pnlUsd >= 0 ? `+${formatCompactUsd(p.pnlUsd)}` : formatCompactUsd(p.pnlUsd);
  }

  const shareAmountMotionBasis: PnlMomentBasis | null =
    !displayPayloadStable || displayPayloadStable.pnlUsd == null || !Number.isFinite(displayPayloadStable.pnlUsd)
      ? null
      : composer.chainTicker === 'SOL' && solUsdQ.data != null && solUsdQ.data > 0
        ? { kind: 'sol', value: displayPayloadStable.pnlUsd / solUsdQ.data }
        : { kind: 'usd', value: displayPayloadStable.pnlUsd };

  const shareAmountRevealKey = displayPayloadStable
    ? `${displayPayloadStable.walletAddress}|${displayPayloadStable.tokenTicker}|${composer.chainTicker}|${displayPayloadStable.pnlUsd ?? ''}`
    : '';

  const onDownloadPng = async () => {
    const p = displayPayloadStable;
    if (!cardRef.current || !p) return;
    setBusy('png');
    try {
      await exportShareImagePng(cardRef.current, `${filenameBase(p.tokenTicker, p.walletAddress)}.png`);
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
      const ok = await copyShareImagePng(cardRef.current);
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
        width: 1280,
        height: 720,
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
          headlineText: composer.headlineText,
          referralCode: referralQ.data?.code ?? null,
          backgroundId: composer.backgroundId,
          momentBasis: shareAmountMotionBasis,
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
  const referralCode = referralQ.data?.code ?? 'POINTER';

  return (
    <div className="fixed inset-0 z-[570] flex items-center justify-center p-3 sm:p-6">
      <button
        type="button"
        className={cn(
          'absolute inset-0 bg-black/78 backdrop-blur-lg',
          overlayBackdropClasses(overlayVisible),
          'fill-mode-forwards',
        )}
        onClick={() => close()}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          'relative flex max-h-[94vh] w-full max-w-[1120px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[#05080d]/[0.98] shadow-[0_36px_130px_-48px_rgba(0,0,0,1)] fill-mode-forwards',
          overlayPanelClasses(overlayVisible),
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-white/[0.065] px-5 py-3.5">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-fg-muted">
              PNL Share Composer
            </p>
            <p className="mt-1 text-[12px] text-fg-secondary">
              {d.tokenTicker} · {shortenAddress(d.walletAddress, 5)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => close()}
            className="rounded-md px-2.5 py-1.5 text-[11px] font-medium text-fg-muted transition hover:bg-white/[0.04] hover:text-fg-primary"
          >
            Close
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4 lg:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0 space-y-3">
            <div className="mx-auto w-full">
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
                headlineText={composer.headlineText}
                referralCode={referralCode}
                editableHeadline
                onHeadlineChange={composer.setHeadlineText}
                amountMotionBasis={shareAmountMotionBasis}
                amountMotionFrozen={busy === 'png' || busy === 'copy'}
                amountRevealKey={shareAmountRevealKey}
              />
              <video
                ref={videoExportRef}
                className="pointer-events-none fixed left-[-10000px] top-0 h-[720px] w-[1280px] max-w-none opacity-0"
                width={1280}
                height={720}
                playsInline
                preload="auto"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-0.5 rounded-lg border border-white/[0.075] bg-black/35 p-0.5">
                <button
                  type="button"
                  onClick={() => composer.setMode('image')}
                  className={cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[11px] font-semibold transition',
                    composer.mode === 'image'
                      ? 'bg-white/[0.07] text-fg-primary'
                      : 'text-fg-muted hover:bg-white/[0.03] hover:text-fg-secondary',
                  )}
                >
                  <ImageIcon className="h-3.5 w-3.5" strokeWidth={2} />
                  Image
                </button>
                <button
                  type="button"
                  onClick={() => composer.setMode('video')}
                  className={cn(
                    'inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[11px] font-semibold transition',
                    composer.mode === 'video'
                      ? 'bg-white/[0.07] text-accent-primary'
                      : 'text-fg-muted hover:bg-white/[0.03] hover:text-fg-secondary',
                  )}
                >
                  <VideoIcon className="h-3.5 w-3.5" strokeWidth={2} />
                  Video
                </button>
              </div>

              {composer.mode === 'video' && customVideoUrl ? (
                <span className="rounded-full border border-emerald-400/15 bg-emerald-400/[0.06] px-2.5 py-1 text-[10px] font-semibold text-emerald-200/80">
                  Saved video
                </span>
              ) : null}
            </div>

            {composer.mode === 'image' ? (
              <ShareBackgroundPicker
                selectedId={composer.backgroundId}
                onSelect={composer.setBackgroundId}
                onPickImageFile={(f) => void onPickImage(f)}
                disabled={Boolean(busy)}
              />
            ) : (
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center gap-2">
                  <label className="cursor-pointer rounded-xl border border-dashed border-white/[0.1] bg-white/[0.025] px-4 py-3 text-[11px] text-fg-muted transition hover:border-accent-primary/35 hover:bg-white/[0.035]">
                    <span className="font-semibold text-fg-secondary">Upload video</span>
                    <span className="mt-1 block text-[10px] leading-snug">
                      MP4 / WebM · max {(SHARE_VIDEO_MAX_BYTES / (1024 * 1024)).toFixed(0)}MB · max{' '}
                      {SHARE_VIDEO_MAX_DURATION_SEC}s
                    </span>
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
                  <span className="rounded-full border border-white/[0.08] bg-white/[0.03] px-2 py-1 text-[10px] font-semibold text-fg-muted">
                    Slots 1 / 3
                  </span>
                  <button
                    type="button"
                    onClick={() => void clearVideo()}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 text-[11px] font-medium text-fg-muted transition hover:border-rose-400/35 hover:text-rose-300"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((v) => !v)}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-white/[0.025] px-2.5 text-[11px] font-medium text-fg-muted transition hover:border-white/[0.14] hover:text-fg-secondary"
                  >
                    <Settings2 className="h-3.5 w-3.5" strokeWidth={2} />
                    Advanced
                  </button>
                </div>

                {customVideoUrl ? (
                  <div className="space-y-3 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
                        Video controls
                      </p>
                      <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={toggleVideoPlay}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/20 px-3 text-[11px] font-semibold text-fg-secondary transition hover:border-accent-primary/35 hover:text-accent-primary"
                      >
                        {videoPlaying ? (
                          <Pause className="h-3.5 w-3.5" strokeWidth={2} />
                        ) : (
                          <Play className="h-3.5 w-3.5" strokeWidth={2} />
                        )}
                        {videoPlaying ? 'Pause card video' : 'Play card video'}
                      </button>
                      <button
                        type="button"
                        onClick={toggleVideoMuted}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-white/[0.08] bg-black/20 px-3 text-[11px] font-semibold text-fg-secondary transition hover:border-white/[0.14] hover:text-fg-primary"
                      >
                        {videoMuted ? (
                          <VolumeX className="h-3.5 w-3.5" strokeWidth={2} />
                        ) : (
                          <Volume2 className="h-3.5 w-3.5" strokeWidth={2} />
                        )}
                        {videoMuted ? 'Muted' : 'Sound on'}
                      </button>
                      </div>
                    </div>
                    <VideoScrubber video={videoPreviewRef} onSeek={seekPreviewVideo} />
                    <p className="text-[10px] text-fg-muted">Preview only. Export keeps audio/frame settings.</p>
                    {advancedOpen ? (
                      <VideoFrameControls
                        pan={composer.videoPan}
                        zoom={composer.videoZoom}
                        onPan={composer.setVideoPan}
                        onZoom={composer.setVideoZoom}
                        onReset={() => {
                          composer.setVideoPan({ x: 0, y: 0 });
                          composer.setVideoZoom(1);
                        }}
                      />
                    ) : null}
                  </div>
                ) : (
                  <p className="text-[12px] text-fg-muted">
                    Upload a clip once — we keep it locally and autoplay it whenever you return to Video mode.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.07] bg-white/[0.018] p-2">
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomize((s) => !s)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 text-[11px] font-semibold text-fg-secondary transition hover:border-accent-primary/35 hover:text-accent-primary"
                >
                  <Paintbrush className="h-3.5 w-3.5" strokeWidth={2} />
                  Customize
                </button>
                <button
                  type="button"
                  onClick={toggleChain}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 text-[11px] font-semibold text-fg-secondary transition hover:border-white/[0.14] hover:text-fg-primary"
                >
                  <ArrowDownUp className="h-3.5 w-3.5" strokeWidth={2} />
                  {composer.chainTicker}
                </button>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    composer.mode === 'video' ? void onExportVideo() : void onDownloadPng()
                  }
                  disabled={busy !== null || (composer.mode === 'video' && !customVideoUrl)}
                  className={cn(
                    'inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[11px] font-bold transition disabled:opacity-45',
                    composer.mode === 'video'
                      ? 'border-accent-primary/45 bg-accent-primary/18 text-accent-primary hover:bg-accent-primary/25'
                      : 'border-accent-primary/45 bg-accent-primary/18 text-accent-primary hover:bg-accent-primary/25',
                  )}
                >
                  {busy === 'png' || busy === 'video' ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Download className="h-3.5 w-3.5" strokeWidth={2} />
                  )}
                  {busy === 'video'
                    ? `${videoProg}%`
                    : composer.mode === 'video'
                      ? 'Download Video'
                      : 'Download PNG'}
                </button>
                <button
                  type="button"
                  onClick={() => void onCopyPng()}
                  disabled={busy !== null}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 text-[11px] font-semibold text-fg-secondary transition hover:border-white/[0.14] hover:text-fg-primary disabled:opacity-45"
                >
                  {busy === 'copy' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" strokeWidth={2} />}
                  Copy
                </button>
                {composer.mode === 'video' ? (
                  <button
                    type="button"
                    onClick={() => void onExportVideo()}
                    disabled={busy !== null || !customVideoUrl}
                    className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.1] bg-white/[0.045] px-3 text-[11px] font-semibold text-fg-primary transition hover:bg-white/[0.075] disabled:opacity-40"
                  >
                    {busy === 'video' ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <VideoIcon className="h-3.5 w-3.5" strokeWidth={2} />
                    )}
                    Export Video
                  </button>
                ) : null}
                {'share' in navigator && composer.mode !== 'video' ? (
                <button
                  type="button"
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 text-[11px] font-semibold text-fg-muted transition hover:border-white/[0.14] hover:text-fg-secondary"
                  onClick={async () => {
                    if (!cardRef.current) return;
                    try {
                      await exportShareImagePng(
                        cardRef.current,
                        `${filenameBase(d.tokenTicker, d.walletAddress)}.png`,
                      );
                      toast.success('Prepared download for sharing');
                    } catch {
                      toast.error('Share failed');
                    }
                  }}
                >
                  Native share (download)
                </button>
                ) : null}
              </div>
            </div>

            {composer.mode === 'image' && customImageUrl ? (
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                  Image position
                </p>
                <div
                  className="relative mt-2 aspect-video cursor-grab overflow-hidden rounded-lg border border-white/[0.08] active:cursor-grabbing"
                  onMouseDown={(down) => {
                    const startX = down.clientX;
                    const startY = down.clientY;
                    const ox = composer.imagePan.x;
                    const oy = composer.imagePan.y;
                    function move(ev: MouseEvent) {
                      composer.setImagePan({
                        x: ox + (ev.clientX - startX),
                        y: oy + (ev.clientY - startY),
                      });
                    }
                    function up() {
                      window.removeEventListener('mousemove', move);
                      window.removeEventListener('mouseup', up);
                    }
                    window.addEventListener('mousemove', move);
                    window.addEventListener('mouseup', up);
                  }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={customImageUrl} alt="" className="h-full w-full object-cover opacity-70" />
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <label className="flex flex-1 items-center gap-2 text-[11px] text-fg-muted">
                    Zoom
                    <input
                      type="range"
                      min={1}
                      max={2}
                      step={0.02}
                      value={composer.imageZoom}
                      onChange={(e) => composer.setImageZoom(Number(e.target.value))}
                      className="flex-1 accent-accent-primary"
                    />
                  </label>
                  <button
                    type="button"
                    className="text-[11px] font-medium text-accent-primary hover:underline"
                    onClick={() => {
                      composer.setImagePan({ x: 0, y: 0 });
                      composer.setImageZoom(1);
                    }}
                  >
                    Reset
                  </button>
                </div>
              </div>
            ) : null}

            {showCustomize ? (
              <ShareCustomizePanel
                overlay={composer.overlay}
                onChange={composer.patchOverlay}
                onReset={composer.resetDefaults}
              />
            ) : null}
          </div>

          <aside className="hidden space-y-3 lg:block">
            <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4 text-[12px] text-fg-secondary">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[13px] font-semibold text-fg-primary">Receipt mode</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-fg-muted">
                    Optimized for X and Telegram flex posts.
                  </p>
                </div>
                <span className="rounded-full border border-white/[0.08] bg-black/20 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.12em] text-fg-muted">
                  16:9
                </span>
              </div>

              <div className="mt-4 space-y-2.5">
                <ReceiptRow label="Mode" value={composer.mode === 'video' ? 'Video' : 'Image'} />
                <ReceiptRow
                  label="Background"
                  value={
                    composer.mode === 'video'
                      ? customVideoUrl
                        ? 'Video selected'
                        : 'No video'
                      : customImageUrl
                        ? 'Image selected'
                        : composer.backgroundId
                  }
                />
                <ReceiptRow
                  label="Output"
                  value={composer.mode === 'video' ? 'MP4 / WebM' : 'PNG'}
                />
                <ReceiptRow label="Referral" value={referralCode} strong />
              </div>

              <div className="mt-4 border-t border-white/[0.07] pt-3">
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
                  Card checks
                </p>
                <div className="mt-2 space-y-1.5">
                  <CheckLine label="Background saved locally" on={Boolean(customVideoUrl || customImageUrl)} />
                  <CheckLine label="Pointer branding visible" on={composer.overlay.showBranding} />
                  <CheckLine label="Text overlay editable" on />
                  <CheckLine label="PNL readable" on />
                </div>
              </div>

              <div className="mt-4 grid gap-2">
                <button
                  type="button"
                  onClick={() => setShowCustomize((s) => !s)}
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/[0.08] bg-black/20 px-3 text-[11px] font-semibold text-fg-secondary transition hover:border-accent-primary/35 hover:text-accent-primary"
                >
                  <Paintbrush className="h-3.5 w-3.5" strokeWidth={2} />
                  Customize overlay
                </button>
                <button
                  type="button"
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-white/[0.06] bg-black/10 px-3 text-[11px] font-semibold text-fg-muted opacity-70"
                  title="Share to lobby will be enabled when lobby publishing is connected."
                  disabled
                >
                  <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
                  Share to lobby
                </button>
              </div>
            </div>
          </aside>
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

function VideoFrameControls({
  pan,
  zoom,
  onPan,
  onZoom,
  onReset,
}: {
  pan: { x: number; y: number };
  zoom: number;
  onPan: (pan: { x: number; y: number }) => void;
  onZoom: (zoom: number) => void;
  onReset: () => void;
}) {
  return (
    <div className="rounded-lg border border-white/[0.07] bg-black/20 p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-fg-muted">
          Frame
        </p>
        <button
          type="button"
          onClick={onReset}
          className="text-[11px] font-medium text-accent-primary/90 hover:text-accent-primary"
        >
          Reset
        </button>
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <FrameSlider
          label="X"
          value={pan.x}
          min={-50}
          max={50}
          step={1}
          onChange={(x) => onPan({ ...pan, x })}
        />
        <FrameSlider
          label="Y"
          value={pan.y}
          min={-50}
          max={50}
          step={1}
          onChange={(y) => onPan({ ...pan, y })}
        />
        <FrameSlider
          label="Zoom"
          value={zoom}
          min={1}
          max={2.5}
          step={0.02}
          onChange={onZoom}
          display={`${zoom.toFixed(2)}x`}
        />
      </div>
    </div>
  );
}

function FrameSlider({
  label,
  value,
  min,
  max,
  step,
  onChange,
  display,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  display?: string;
}) {
  return (
    <label className="min-w-0 text-[10.5px] text-fg-muted">
      <span className="flex items-center justify-between gap-2">
        <span className="font-medium">{label}</span>
        <span className="tabular-nums text-fg-secondary">{display ?? value}</span>
      </span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full accent-accent-primary"
      />
    </label>
  );
}

function ReceiptRow({
  label,
  value,
  strong,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[11px]">
      <span className="text-fg-muted">{label}</span>
      <span
        className={cn(
          'truncate text-right font-semibold',
          strong ? 'text-fg-primary' : 'text-fg-secondary',
        )}
      >
        {value}
      </span>
    </div>
  );
}

function CheckLine({ label, on }: { label: string; on: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[11px] text-fg-secondary">
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          on ? 'bg-accent-primary/80' : 'bg-white/20',
        )}
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}
