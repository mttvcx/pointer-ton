'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import {
  normalizeAnnouncementInput,
  type FeatureAnnouncementSlide,
} from '@/lib/onboarding/featureAnnouncementParsed';
import { POINTER_APP_VERSION_LABEL } from '@/lib/reports/buildBugReportPayload';

function youtubeEmbedUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}?rel=0` : null;
    }
    if (/youtube\.com$/i.test(u.hostname) || u.hostname.endsWith('.youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${encodeURIComponent(v)}?rel=0`;
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed' && parts[1]) {
        return `https://www.youtube.com/embed/${encodeURIComponent(parts[1])}?rel=0`;
      }
    }
  } catch {
    /* bad URL */
  }
  return null;
}

/** Right-hand media: iframe (YouTube) or `<video>` with a slim progress rail */
function AnnouncementDemoVideo({ slide }: { slide: FeatureAnnouncementSlide }) {
  const url = slide.videoUrl ?? '';
  const embed = youtubeEmbedUrl(url);

  const videoRef = useRef<HTMLVideoElement>(null);
  const [pct, setPct] = useState(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || embed) return;
    const onTime = () => {
      const d = v.duration || 1;
      setPct((v.currentTime / d) * 100);
    };
    const onMeta = () => setPct(v.currentTime ? (v.currentTime / (v.duration || 1)) * 100 : 0);
    v.addEventListener('timeupdate', onTime);
    v.addEventListener('loadedmetadata', onMeta);
    return () => {
      v.removeEventListener('timeupdate', onTime);
      v.removeEventListener('loadedmetadata', onMeta);
    };
  }, [embed, url]);

  /* Reset playback when swapping slides */
  useEffect(() => {
    const v = videoRef.current;
    if (!v || embed) return;
    v.pause();
    v.currentTime = 0;
    setPct(0);
    void v.load();
  }, [embed, slide.id, url]);

  if (!url.trim()) {
    return (
      <div className="flex aspect-video h-full min-h-[220px] w-full flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-black/50 text-center">
        <p className="text-[13px] font-medium text-white/45">Demo video coming soon</p>
      </div>
    );
  }

  if (embed) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
        <iframe title={slide.title} src={embed} className="h-full w-full" allowFullScreen />
      </div>
    );
  }

  const looksStream =
    /\.(mp4|webm|ogg)(\?|$)/i.test(url) || url.startsWith('blob:') || url.startsWith('data:');
  if (looksStream) {
    return (
      <div className="relative w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-black shadow-[inset_0_0_0_1px_rgba(255,255,255,0.03)]">
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video
          ref={videoRef}
          src={url}
          controls
          playsInline
          className="aspect-video max-h-[min(52vh,420px)] w-full object-contain"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-10 h-px px-2">
          <div className="h-0.5 w-full rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-white/85 transition-[width] duration-150 ease-out"
              style={{ width: `${Math.min(100, pct)}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex aspect-video w-full flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-black/55 p-8 text-center">
      <Link
        href={url}
        target="_blank"
        rel="noreferrer"
        className="text-[13px] font-semibold text-emerald-300/90 underline-offset-4 hover:underline"
      >
        Open demo link
      </Link>
    </div>
  );
}

export type FeatureAnnouncementModalProps = {
  open: boolean;
  headline: string;
  description: string;
  videoUrl?: string | null;
  onGotIt: () => void;
  className?: string;
};

export function FeatureAnnouncementModal({
  open,
  headline,
  description,
  videoUrl,
  onGotIt,
  className,
}: FeatureAnnouncementModalProps) {
  const normalized = useMemo(
    () => normalizeAnnouncementInput({ headline, description, videoUrl: videoUrl ?? null }),
    [headline, description, videoUrl],
  );

  const { title, carousel, badge, slides } = normalized;

  const [idx, setIdx] = useState(0);

  /* Reset carousel index when reopening payload */
  useEffect(() => {
    if (open) setIdx(0);
  }, [open, headline]);

  const activeSlide = slides[Math.min(Math.max(idx, 0), Math.max(slides.length - 1, 0))] ?? slides[0];

  const onKey = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onGotIt();
    },
    [onGotIt],
  );

  useEffect(() => {
    if (!open) return;
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onKey]);

  const versionLabel = badge?.trim() || `v${POINTER_APP_VERSION_LABEL}`;

  function goPrev() {
    setIdx((i) => Math.max(0, i - 1));
  }

  function goNextOrClose() {
    if (carousel && slides.length > 1 && idx < slides.length - 1) {
      setIdx((i) => i + 1);
      return;
    }
    onGotIt();
  }

  const isLastSlide = carousel && slides.length > 1 ? idx >= slides.length - 1 : true;
  const primaryCtaLabel = isLastSlide ? 'Done' : 'Next';

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feat-announce-title"
      className={cn(
        'fixed inset-0 z-[560] flex items-center justify-center p-3 animate-in fade-in duration-300 sm:p-8',
        'bg-black/65 backdrop-blur-xl',
        className,
      )}
    >
      <div
        className={cn(
          'relative grid w-full max-h-[calc(100dvh-48px)] max-w-[980px] overflow-hidden rounded-[18px]',
          'border border-white/[0.09]',
          'bg-[#06080d]',
          'shadow-[0_40px_120px_-52px_rgba(0,0,0,0.95)]',
          'animate-in zoom-in-[0.985] fade-in duration-300 ease-out',
          'grid-rows-[auto_1fr]',
          'md:grid-cols-[minmax(220px,40%)_minmax(0,1fr)] md:gap-0',
        )}
      >
        <button
          type="button"
          onClick={onGotIt}
          className="absolute right-3 top-3 z-10 rounded-md p-1.5 text-white/45 transition-colors hover:bg-white/[0.07] hover:text-white md:right-4 md:top-4"
          aria-label="Close"
        >
          <X className="h-5 w-5" strokeWidth={2} aria-hidden />
        </button>

        {/* Left */}
        <div className="flex min-h-0 flex-col gap-6 border-white/[0.06] pb-24 pl-8 pr-10 pt-8 md:border-r md:pb-8">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/branding/pointer-bird.png"
              alt=""
              width={36}
              height={36}
              className="h-9 w-9 shrink-0 object-contain brightness-105"
              draggable={false}
            />
          </div>

          <h2
            id="feat-announce-title"
            className="text-[clamp(17px,1.95vw,22px)] font-bold leading-[1.35] tracking-tight text-white"
          >
            {title}
          </h2>

          {/* Feature list */}
          <div className="min-h-0 flex-1 overflow-y-auto pr-2">
            {carousel && slides.length > 1 ? (
              <ul className="space-y-6">
                {slides.map((s, i) => {
                  const on = i === idx;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={on}
                        onClick={() => setIdx(i)}
                        className="w-full text-left transition-colors"
                      >
                        <span
                          className={cn(
                            'block text-[15px] leading-snug tracking-tight',
                            on ? 'font-semibold text-white' : 'font-medium text-white/35 hover:text-white/55',
                          )}
                        >
                          {s.title}
                        </span>
                        {on && s.description ? (
                          <p className="mt-2 max-w-[340px] text-[12.5px] leading-relaxed text-white/[0.82] md:max-w-none">
                            {s.description}
                          </p>
                        ) : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="space-y-2">
                <p className="text-[13px] font-semibold uppercase tracking-[0.1em] text-white/52">
                  Highlights
                </p>
                {activeSlide?.description ? (
                  <p className="max-w-[400px] text-[13px] leading-[1.6] text-white/78 md:max-w-none">
                    {activeSlide.description}
                  </p>
                ) : null}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="absolute inset-x-0 bottom-0 border-t border-white/[0.055] bg-[#06080d] px-8 py-3.5 md:static md:border-t-0 md:bg-transparent md:px-0 md:pb-1 md:pt-0">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div className="text-[11px] text-white/38">
                <span className="font-mono tabular-nums">{versionLabel}</span>
                <span className="mx-2 opacity-35">·</span>
                <Link
                  href="/pulse"
                  className="font-medium text-white/55 underline-offset-4 transition-colors hover:text-white/80 hover:underline"
                  onClick={onGotIt}
                >
                  Previous updates
                </Link>
              </div>
              <div className="flex items-center justify-end gap-2">
                {carousel && slides.length > 1 ? (
                  <button
                    type="button"
                    onClick={goPrev}
                    disabled={idx === 0}
                    className={cn(
                      'rounded-xl border border-white/[0.1] bg-white/[0.04] px-4 py-2 text-[13px] font-semibold text-white/75 transition-colors',
                      'hover:bg-white/[0.08] hover:text-white',
                      idx === 0 && 'cursor-not-allowed opacity-38 hover:bg-white/[0.04]',
                    )}
                  >
                    Back
                  </button>
                ) : (
                  <span className="hidden w-px sm:inline" aria-hidden />
                )}
                <button
                  type="button"
                  onClick={goNextOrClose}
                  className={cn(
                    'rounded-xl px-5 py-2 text-[13px] font-bold tracking-wide text-[#07130e]',
                    'bg-[linear-gradient(180deg,#54f098_0%,#3DDC97_55%,#2abf7d_100%)]',
                    'shadow-[inset_0_1px_0_rgba(255,255,255,0.28),0_14px_40px_-26px_rgba(61,220,151,0.55)]',
                    'transition-[filter] duration-150 hover:brightness-[1.05] active:brightness-[0.98]',
                  )}
                >
                  {primaryCtaLabel}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right — video */}
        <div className="flex flex-col gap-5 border-t border-white/[0.05] px-8 pb-8 pt-6 md:border-t-0 md:pb-12 md:pl-16 md:pr-12 md:pt-28">
          {activeSlide ? (
            <>
              {/* Mobile title */}
              {!carousel ? (
                <p className="text-[17px] font-bold text-white md:hidden">{title}</p>
              ) : null}
              <AnnouncementDemoVideo key={activeSlide.id} slide={activeSlide} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
