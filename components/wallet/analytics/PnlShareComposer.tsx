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
  Settings2,
  Trash2,
  Video as VideoIcon,
  Share2,
} from 'lucide-react';
import { toast } from 'sonner';
import { PnlShareCard } from '@/components/wallet/analytics/PnlShareCard';
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
import { useWalletIntelStore } from '@/store/walletIntelStore';
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

  const cardRef = useRef<HTMLDivElement>(null);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const videoExportRef = useRef<HTMLVideoElement>(null);

  const composer = useShareComposerState();
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);
  const [customVideoUrl, setCustomVideoUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState<'png' | 'copy' | 'webm' | null>(null);
  const [showCustomize, setShowCustomize] = useState(false);
  const [videoProg, setVideoProg] = useState(0);
  const [advancedOpen, setAdvancedOpen] = useState(false);

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

  useEffect(() => {
    let revoked: string[] = [];
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
    v.muted = true;
    const p = v.play();
    if (p && typeof p.catch === 'function') void p.catch(() => {});
  }, [open, composer.mode, customVideoUrl]);

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

  function amountPrimaryText(): string | null {
    if (!payload) return null;
    if (composer.chainTicker === 'SOL' && solUsdQ.data != null && payload.pnlUsd != null) {
      const sol = payload.pnlUsd / solUsdQ.data;
      const sign = sol >= 0 ? '+' : '-';
      return `${sign}${Math.abs(sol).toFixed(3)} SOL`;
    }
    if (payload.pnlUsd == null) return null;
    return payload.pnlUsd >= 0 ? `+${formatCompactUsd(payload.pnlUsd)}` : formatCompactUsd(payload.pnlUsd);
  }

  const onDownloadPng = async () => {
    if (!cardRef.current || !payload) return;
    setBusy('png');
    try {
      await exportShareImagePng(cardRef.current, `${filenameBase(payload.tokenTicker, payload.walletAddress)}.png`);
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
    if (!payload || !customVideoUrl) {
      toast.error('Add a video background first');
      return;
    }
    const vid = videoExportRef.current;
    if (!vid) return;
    vid.src = customVideoUrl;
    vid.muted = true;
    vid.loop = false;
    setBusy('webm');
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
          ticker: payload.tokenTicker,
          tokenName: payload.tokenName,
          pnlUsd: payload.pnlUsd,
          pnlPct: payload.pnlPct,
          investedUsd: payload.investedUsd,
          positionUsd: payload.positionUsd,
          walletLabel: payload.walletLabel,
          walletAddress: payload.walletAddress,
          accentHex: pickAccentHex(composer.overlay.accent),
          chainTicker: composer.chainTicker,
        },
        maxDurationSec: SHARE_VIDEO_MAX_DURATION_SEC,
        onProgress: (p) => setVideoProg(p),
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filenameBase(payload.tokenTicker, payload.walletAddress)}.webm`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('WebM exported');
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

  if (!open || !payload) return null;

  const showVideoBg = composer.mode === 'video' && customVideoUrl;
  const showImageBg = composer.mode === 'image' && customImageUrl;

  return (
    <div className="fixed inset-0 z-[140] flex animate-in fade-in items-center justify-center p-3 duration-200 sm:p-8">
      <button type="button" className="absolute inset-0 bg-black/75 backdrop-blur-lg" onClick={() => close()} />
      <div
        role="dialog"
        aria-modal="true"
        className="relative flex max-h-[95vh] w-full max-w-[980px] flex-col overflow-hidden rounded-2xl border border-white/[0.08] bg-[rgba(5,8,14,0.96)] shadow-[0_48px_140px_-40px_rgba(0,0,0,1)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-fg-muted">
              PNL Share Composer
            </p>
            <p className="mt-1 text-[13px] text-fg-secondary">
              {payload.tokenTicker} · {shortenAddress(payload.walletAddress, 5)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => close()}
            className="rounded-lg px-2 py-1 text-[11px] text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
          >
            Close
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto px-5 py-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div className="mx-auto w-full max-w-[820px]">
              <PnlShareCard
                ref={cardRef}
                payload={payload}
                overlay={composer.overlay}
                backgroundId={composer.backgroundId}
                customImageSrc={showImageBg ? customImageUrl : null}
                imagePan={composer.imagePan}
                imageZoom={composer.imageZoom}
                amountPrimary={amountPrimaryText()}
                videoSrc={showVideoBg ? customVideoUrl : null}
              />
              <video ref={videoExportRef} className="pointer-events-none fixed left-[-9999px] h-px w-px opacity-0" muted playsInline />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 rounded-full border border-border-subtle/80 bg-black/40 p-1">
                <button
                  type="button"
                  onClick={() => composer.setMode('image')}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition',
                    composer.mode === 'image'
                      ? 'bg-accent-primary/20 text-accent-primary'
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
                    'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition',
                    composer.mode === 'video'
                      ? 'bg-accent-primary/20 text-accent-primary'
                      : 'text-fg-muted hover:text-fg-secondary',
                  )}
                >
                  <VideoIcon className="h-3.5 w-3.5" strokeWidth={2} />
                  Video
                </button>
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-border-subtle px-3 py-1.5 text-[11px] font-medium text-fg-muted hover:border-border-default hover:text-fg-secondary"
                title="Share to lobby when available"
                disabled
              >
                <Share2 className="h-3.5 w-3.5" strokeWidth={2} />
                Share to lobby
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
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-3">
                  <label className="cursor-pointer rounded-xl border border-dashed border-border-subtle bg-black/30 px-4 py-3 text-[11px] text-fg-muted hover:border-accent-primary/35">
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
                  <span className="text-[10px] text-fg-muted">Slots 1 / 3</span>
                  <button
                    type="button"
                    onClick={() => void clearVideo()}
                    className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-2 py-1 text-[11px] text-fg-muted hover:border-signal-bear/40 hover:text-signal-bear"
                  >
                    <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
                    Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdvancedOpen((v) => !v)}
                    className="inline-flex items-center gap-1 rounded-lg border border-border-subtle px-2 py-1 text-[11px] text-fg-muted hover:text-fg-secondary"
                  >
                    <Settings2 className="h-3.5 w-3.5" strokeWidth={2} />
                    Advanced
                  </button>
                </div>

                {customVideoUrl ? (
                  <div className="space-y-2">
                    <video
                      ref={videoPreviewRef}
                      className="max-h-36 w-full rounded-lg border border-border-subtle object-cover"
                      src={customVideoUrl}
                      muted
                      playsInline
                      loop
                      controls={advancedOpen}
                      onLoadedMetadata={(e) => {
                        const d = e.currentTarget.duration;
                        if (d > SHARE_VIDEO_MAX_DURATION_SEC) {
                          toast.message(`Clip is ${Math.round(d)}s — export uses first ${SHARE_VIDEO_MAX_DURATION_SEC}s`);
                        }
                      }}
                    />
                    <VideoScrubber video={videoPreviewRef} />
                  </div>
                ) : (
                  <p className="text-[12px] text-fg-muted">
                    Upload a clip once — we keep it locally and autoplay it whenever you return to Video mode.
                  </p>
                )}
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setShowCustomize((s) => !s)}
                className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-[11px] font-semibold text-fg-secondary hover:border-accent-primary/35 hover:text-accent-primary"
              >
                <Paintbrush className="h-3.5 w-3.5" strokeWidth={2} />
                Customize
              </button>
              <button
                type="button"
                onClick={toggleChain}
                className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-[11px] font-semibold text-fg-secondary hover:border-border-default"
              >
                <ArrowDownUp className="h-3.5 w-3.5" strokeWidth={2} />
                {composer.chainTicker}
              </button>
              <button
                type="button"
                onClick={() => void onDownloadPng()}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-accent-primary/35 bg-accent-primary/15 px-3 py-2 text-[11px] font-semibold text-accent-primary hover:bg-accent-primary/25 disabled:opacity-50"
              >
                {busy === 'png' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" strokeWidth={2} />}
                Download
              </button>
              <button
                type="button"
                onClick={() => void onCopyPng()}
                disabled={busy !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-[11px] font-semibold text-fg-secondary hover:border-border-default disabled:opacity-50"
              >
                {busy === 'copy' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Copy className="h-3.5 w-3.5" strokeWidth={2} />}
                Copy
              </button>
              {composer.mode === 'video' ? (
                <button
                  type="button"
                  onClick={() => void onExportVideo()}
                  disabled={busy !== null || !customVideoUrl}
                  className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/[0.06] px-3 py-2 text-[11px] font-semibold text-fg-primary hover:bg-white/[0.09] disabled:opacity-40"
                >
                  {busy === 'webm' ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {videoProg}%
                    </>
                  ) : (
                    <>
                      <VideoIcon className="h-3.5 w-3.5" strokeWidth={2} />
                      Export Video
                    </>
                  )}
                </button>
              ) : null}
              {'share' in navigator ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-2 rounded-lg border border-border-subtle px-3 py-2 text-[11px] font-semibold text-fg-muted hover:text-fg-secondary"
                  onClick={async () => {
                    if (!cardRef.current) return;
                    try {
                      await exportShareImagePng(
                        cardRef.current,
                        `${filenameBase(payload.tokenTicker, payload.walletAddress)}.png`,
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

            {composer.mode === 'image' && customImageUrl ? (
              <div className="rounded-xl border border-border-subtle/60 bg-black/25 p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-fg-muted">
                  Image position
                </p>
                <div
                  className="relative mt-2 aspect-video cursor-grab overflow-hidden rounded-lg border border-border-subtle active:cursor-grabbing"
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
            <div className="rounded-xl border border-border-subtle/70 bg-black/30 p-4 text-[12px] text-fg-secondary">
              <p className="font-semibold text-fg-primary">Receipt mode</p>
              <p className="mt-2 leading-relaxed text-fg-muted">
                Backgrounds stay on-device unless you export or share them yourself. Pointer defaults are tuned for X /
                Telegram flex posts.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}

function VideoScrubber({ video }: { video: RefObject<HTMLVideoElement | null> }) {
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
      <span>
        {fmt(t)} / {fmt(d)}
      </span>
      <input
        type="range"
        min={0}
        max={d || 1}
        step={0.01}
        value={t}
        onChange={(e) => {
          const el = video.current;
          if (!el) return;
          el.currentTime = Number(e.target.value);
        }}
        className="h-1 flex-1 accent-accent-primary"
      />
    </div>
  );
}
