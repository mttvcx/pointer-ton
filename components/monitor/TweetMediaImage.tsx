'use client';

import { useRef, useState, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';

function absUrl(u: string): string {
  if (typeof window === 'undefined') return u;
  try {
    return new URL(u, window.location.origin).href;
  } catch {
    return u;
  }
}

/**
 * Tweet media thumbnail — mirrors the Pulse avatar behaviour:
 *  - hover shows an enlarged floating preview (viewport-clamped)
 *  - click opens Google Lens reverse-image search for the media
 */
export function TweetMediaImage({ src, alt = '' }: { src: string; alt?: string }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [preview, setPreview] = useState<{ top: number; left: number } | null>(null);

  function openLens(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    window.open(
      `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(absUrl(src))}`,
      '_blank',
      'noopener,noreferrer',
    );
  }

  function showPreview() {
    const el = ref.current;
    if (!el || typeof window === 'undefined') return;
    const r = el.getBoundingClientRect();
    const W = 360;
    // Prefer the right of the thumbnail; flip left if it would overflow.
    let left = r.right + 10;
    if (left + W > window.innerWidth - 12) left = Math.max(12, r.left - W - 10);
    const top = Math.min(Math.max(12, r.top), Math.max(12, window.innerHeight - 340));
    setPreview({ top, left });
  }

  return (
    <>
      <button
        ref={ref}
        type="button"
        onClick={openLens}
        aria-label="Search this image on Google Lens"
        onMouseEnter={showPreview}
        onMouseLeave={() => setPreview(null)}
        className="group/media mt-2 block w-full cursor-zoom-in overflow-hidden rounded-lg border border-white/[0.08] bg-white/[0.02]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          referrerPolicy="no-referrer"
          className="max-h-52 w-full object-cover transition-transform duration-200 group-hover/media:scale-[1.03]"
        />
      </button>
      {preview && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="pointer-events-none fixed z-[800] overflow-hidden rounded-xl border border-white/[0.14] bg-bg-base shadow-2xl"
              style={{ top: preview.top, left: preview.left, width: 360 }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={src}
                alt=""
                referrerPolicy="no-referrer"
                className="max-h-[60vh] w-full object-contain"
              />
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
