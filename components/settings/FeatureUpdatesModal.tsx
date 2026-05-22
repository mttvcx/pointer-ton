'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Rocket, X } from 'lucide-react';
import { FeatureUpdatePreviewMock } from '@/components/settings/FeatureUpdatePreviewMock';
import { FEATURE_UPDATE_SLIDES } from '@/lib/featureUpdates/releases';
import { useOverlayPresence, OVERLAY_ANIM_CLOSE_MS } from '@/lib/hooks/useOverlayPresence';
import { overlayBackdropClasses, overlayPanelClasses } from '@/lib/ui/overlayMotion';
import { Z_APP_MODAL_OVERLAY } from '@/lib/ui/zLayers';
import { cn } from '@/lib/utils/cn';

interface FeatureUpdatesModalProps {
  open: boolean;
  onClose: () => void;
}

export function FeatureUpdatesModal({ open, onClose }: FeatureUpdatesModalProps) {
  const { mounted, visible } = useOverlayPresence(open, OVERLAY_ANIM_CLOSE_MS);
  const [index, setIndex] = useState(0);

  const slides = FEATURE_UPDATE_SLIDES;
  const slide = slides[index] ?? slides[0];
  const isLast = index >= slides.length - 1;

  useEffect(() => {
    if (!open) return;
    setIndex(0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function goNext() {
    if (isLast) onClose();
    else setIndex((i) => Math.min(i + 1, slides.length - 1));
  }

  function goPrevious() {
    setIndex((i) => Math.max(i - 1, 0));
  }

  if (!mounted || !slide) return null;

  return (
    <div className={cn('fixed inset-0 flex items-center justify-center p-4', Z_APP_MODAL_OVERLAY)}>
      <button
        type="button"
        aria-label="Close"
        className={cn(
          'absolute inset-0 cursor-default bg-black/70 backdrop-blur-sm',
          overlayBackdropClasses(visible),
        )}
        onClick={onClose}
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="feature-updates-title"
        className={cn(
          'relative z-10 flex w-full max-w-[440px] flex-col overflow-hidden rounded-xl border border-border-subtle bg-bg-raised shadow-2xl',
          overlayPanelClasses(visible),
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-md text-fg-muted transition-colors hover:bg-bg-hover hover:text-fg-primary"
          aria-label="Close"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="p-4 pb-3">
          <div className="overflow-hidden rounded-lg border border-white/[0.06] bg-bg-sunken">
            {slide.imageSrc ? (
              <div className="relative aspect-[16/10] w-full">
                <Image
                  src={slide.imageSrc}
                  alt={slide.imageAlt ?? slide.title}
                  fill
                  className="object-cover object-top"
                  sizes="440px"
                />
              </div>
            ) : (
              <FeatureUpdatePreviewMock preview={slide.preview} />
            )}
          </div>

          <h2
            id="feature-updates-title"
            className="mt-4 text-center text-[22px] font-semibold tracking-tight text-fg-primary"
          >
            {slide.title}
          </h2>
          <p className="mt-1.5 text-center text-[13px] leading-snug text-fg-secondary">{slide.description}</p>

          <div className="mt-4 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={goPrevious}
              disabled={index === 0}
              className={cn(
                'text-[12px] font-medium text-accent-primary transition-opacity',
                index === 0 ? 'pointer-events-none opacity-0' : 'hover:underline',
              )}
            >
              See previous updates
            </button>
            <div className="flex items-center gap-1.5" aria-hidden>
              {slides.map((s, i) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setIndex(i)}
                  className={cn(
                    'h-1.5 rounded-full transition-all',
                    i === index ? 'w-4 bg-accent-primary' : 'w-1.5 bg-white/25 hover:bg-white/40',
                  )}
                  aria-label={`Slide ${i + 1}`}
                />
              ))}
            </div>
          </div>
        </div>

        <footer className="flex items-center justify-between gap-3 border-t border-border-subtle px-4 py-3">
          <div className="flex min-w-0 items-center gap-2">
            <Rocket className="h-4 w-4 shrink-0 text-accent-primary" strokeWidth={2} aria-hidden />
            <span className="bg-gradient-to-r from-amber-300 via-amber-200 to-sky-300 bg-clip-text text-[12px] font-semibold text-transparent">
              Pointer just updated!
            </span>
          </div>
          <button
            type="button"
            onClick={goNext}
            className="btn-press focus-ring shrink-0 rounded-full bg-accent-primary px-5 py-2 text-[13px] font-semibold text-fg-inverse transition hover:brightness-110"
          >
            {isLast ? 'Done' : 'Next'}
          </button>
        </footer>
      </div>
    </div>
  );
}