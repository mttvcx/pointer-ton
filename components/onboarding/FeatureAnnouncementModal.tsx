'use client';

import { useCallback, useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

function youtubeEmbedUrl(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    if (u.hostname === 'youtu.be') {
      const id = u.pathname.replace(/^\//, '').split('/')[0];
      return id ? `https://www.youtube.com/embed/${encodeURIComponent(id)}` : null;
    }
    if (/youtube\.com$/i.test(u.hostname) || u.hostname.endsWith('.youtube.com')) {
      const v = u.searchParams.get('v');
      if (v) return `https://www.youtube.com/embed/${encodeURIComponent(v)}`;
      const parts = u.pathname.split('/').filter(Boolean);
      if (parts[0] === 'embed' && parts[1]) {
        return `https://www.youtube.com/embed/${encodeURIComponent(parts[1])}`;
      }
    }
  } catch {
    /* bad URL */
  }
  return null;
}

function AnnouncementVideo({ url }: { url: string }) {
  const embed = youtubeEmbedUrl(url);
  if (embed) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-md border border-border-subtle bg-black">
        <iframe
          title="Feature video"
          src={embed}
          className="h-full w-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />
      </div>
    );
  }

  const looksStream =
    /\.(mp4|webm|ogg)(\?|$)/i.test(url) || url.startsWith('blob:') || url.startsWith('data:');
  if (looksStream) {
    return (
      <video
        src={url}
        controls
        className="max-h-64 w-full rounded-md border border-border-subtle bg-black"
      />
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      className="block text-xs font-medium text-accent-primary underline-offset-4 hover:underline"
    >
      Open video
    </a>
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

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="feat-announce-title"
      className={cn(
        'fixed inset-0 z-[105] flex animate-in fade-in items-center justify-center bg-black/70 p-4 duration-200',
        className,
      )}
    >
      <div className="relative w-full max-w-md animate-in zoom-in-95 fade-in rounded-lg border border-border-subtle bg-bg-base p-5 shadow-2xl duration-200">
        <button
          type="button"
          onClick={onGotIt}
          className="absolute right-3 top-3 rounded p-1 text-fg-muted hover:bg-bg-hover hover:text-fg-primary"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        <h2 id="feat-announce-title" className="pr-8 text-base font-semibold text-fg-primary">
          {headline}
        </h2>
        <p className="mt-2 text-xs leading-relaxed text-fg-secondary">{description}</p>
        {videoUrl ? (
          <div className="mt-4">
            <AnnouncementVideo url={videoUrl} />
          </div>
        ) : null}
        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onGotIt}
            className="btn-press rounded-sm bg-accent-primary px-4 py-2 text-sm font-medium text-fg-inverse hover:bg-accent-glow"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
