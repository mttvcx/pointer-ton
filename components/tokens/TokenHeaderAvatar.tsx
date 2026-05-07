'use client';

import { useCallback, useRef, useState } from 'react';
import { usePointerAuth } from '@/lib/auth/pointerAuth';
import { Camera, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

function absImageUrl(src: string): string {
  if (src.startsWith('http://') || src.startsWith('https://')) return src;
  if (typeof window === 'undefined') return src;
  try {
    return new URL(src, window.location.origin).href;
  } catch {
    return src;
  }
}

export function TokenHeaderAvatar({
  src,
  alt,
  mint,
  size = 40,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  mint: string;
  size?: number;
  className?: string;
}) {
  const { getAccessToken, authenticated } = usePointerAuth();
  const [insight, setInsight] = useState<string | null>(null);
  const [insightBusy, setInsightBusy] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openLens = useCallback(() => {
    if (!src) return;
    const url = absImageUrl(src);
    window.open(
      `https://lens.google.com/uploadbyurl?url=${encodeURIComponent(url)}`,
      '_blank',
      'noopener,noreferrer',
    );
  }, [src]);

  const runInsight = useCallback(async () => {
    if (!authenticated || !mint) return;
    setInsightBusy(true);
    try {
      const token = await getAccessToken();
      if (!token) return;
      const r = await fetch('/api/ai/explain-token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ mint, mode: 'fast' }),
      });
      const j = (await r.json().catch(() => ({}))) as {
        summary?: string;
        message?: string;
      };
      if (!r.ok) {
        const err =
          typeof j.message === 'string' ? j.message : `HTTP ${r.status}`;
        setInsight(err.slice(0, 200));
        return;
      }
      setInsight((j.summary ?? '').slice(0, 320));
    } finally {
      setInsightBusy(false);
    }
  }, [authenticated, getAccessToken, mint]);

  const onEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = setTimeout(() => void runInsight(), 420);
  };
  const onLeave = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    hoverTimer.current = null;
    setInsight(null);
    setInsightBusy(false);
  };

  if (!src) {
    return (
      <div
        className={cn('shrink-0 rounded-md bg-bg-hover ring-1 ring-border-subtle', className)}
        style={{ width: size, height: size }}
        aria-hidden
      />
    );
  }

  return (
    <div className="relative shrink-0" onMouseEnter={onEnter} onMouseLeave={onLeave}>
      <button
        type="button"
        onClick={openLens}
        className={cn(
          'group relative overflow-hidden rounded-md ring-1 ring-border-subtle focus-ring',
          className,
        )}
        style={{ width: size, height: size }}
        title="Click: Google Lens. Hover: fast AI token summary (same data as Co-pilot)"
        aria-label="Open token image in Google Lens"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} width={size} height={size} className="h-full w-full object-cover" />
        <span className="absolute inset-0 flex items-center justify-center bg-black/55 opacity-0 transition group-hover:opacity-100">
          <Camera className="h-5 w-5 text-white" aria-hidden />
        </span>
      </button>
      {insight || insightBusy ? (
        <div className="absolute left-0 top-full z-[280] mt-1 w-[min(22rem,calc(100vw-2rem))] rounded-md border border-border-subtle bg-bg-base/98 px-2 py-1.5 text-[10px] leading-snug text-fg-secondary shadow-xl">
          {insightBusy ? (
            <span className="inline-flex items-center gap-1 text-fg-muted">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              Co-pilot peek...
            </span>
          ) : (
            insight
          )}
        </div>
      ) : null}
    </div>
  );
}
