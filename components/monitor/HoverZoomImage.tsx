'use client';

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Thumbnail that pops a big image preview in a portal on hover (Pulse-style) and
 * opens a reverse-image search (Google Lens) on click. Flip-aware vertically,
 * clamped horizontally. Used for X Monitor suggestion + tweet images.
 */
export function HoverZoomImage({
  src,
  className,
  previewW = 260,
}: {
  src: string;
  className?: string;
  previewW?: number;
}) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<{ left: number; top?: number; bottom?: number } | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  const compute = useCallback(() => {
    const el = anchorRef.current;
    if (!el || typeof window === 'undefined') return;
    const r = el.getBoundingClientRect();
    const gap = 8;
    const left = Math.max(8, Math.min(r.left, window.innerWidth - previewW - 8));
    const spaceBelow = window.innerHeight - r.bottom;
    const estH = previewW + 20;
    if (spaceBelow < estH && r.top > spaceBelow) {
      setPos({ left, bottom: Math.max(8, window.innerHeight - r.top + gap) });
    } else {
      setPos({ left, top: r.bottom + gap });
    }
  }, [previewW]);

  const open = () => {
    clear();
    compute();
  };
  const close = () => {
    clear();
    timer.current = setTimeout(() => setPos(null), 110);
  };

  useEffect(() => {
    if (!pos) return;
    const c = () => setPos(null);
    window.addEventListener('scroll', c, true);
    window.addEventListener('resize', c);
    return () => {
      window.removeEventListener('scroll', c, true);
      window.removeEventListener('resize', c);
    };
  }, [pos]);

  const search = (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    window.open(
      `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(src)}`,
      '_blank',
      'noreferrer',
    );
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        onMouseEnter={open}
        onMouseLeave={close}
        onClick={search}
        title="Hover to enlarge · click to reverse-image search"
        className={cn('block cursor-zoom-in overflow-hidden', className)}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt="" referrerPolicy="no-referrer" draggable={false} className="h-full w-full object-cover" />
      </button>
      {pos && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="pointer-events-auto fixed z-[280] overflow-hidden rounded-lg border border-white/[0.12] bg-[#0a0c10] shadow-[0_20px_48px_-12px_rgba(0,0,0,0.9)]"
              style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: previewW }}
              onMouseEnter={open}
              onMouseLeave={close}
            >
              <button type="button" onClick={search} className="group/zi relative block w-full">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" referrerPolicy="no-referrer" draggable={false} className="block h-auto w-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center transition group-hover/zi:bg-black/35">
                  <Search
                    className="h-6 w-6 text-white opacity-0 drop-shadow-[0_1px_6px_rgba(0,0,0,0.85)] transition group-hover/zi:opacity-100"
                    strokeWidth={2}
                    aria-hidden
                  />
                </span>
              </button>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
