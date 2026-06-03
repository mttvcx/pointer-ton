'use client';

import { useMemo, useState } from 'react';
import { getStockLogoCandidates } from '@/lib/stocks/stockLogos';
import { cn } from '@/lib/utils/cn';

function initialsFor(symbol: string): string {
  const s = symbol.trim().toUpperCase();
  if (s.length <= 3) return s;
  return s.slice(0, 3);
}

function avatarGradient(symbol: string): string {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `linear-gradient(135deg, hsl(${hue} 42% 28%) 0%, hsl(${(hue + 40) % 360} 38% 18%) 100%)`;
}

export function StockAvatar({
  symbol,
  size,
  className,
}: {
  symbol: string;
  size: number;
  className?: string;
}) {
  const candidates = useMemo(() => getStockLogoCandidates(symbol), [symbol]);
  const [idx, setIdx] = useState(0);
  const exhausted = idx >= candidates.length;
  const src = candidates[idx];

  if (exhausted || !src) {
    return (
      <div
        className={cn(
          'flex shrink-0 items-center justify-center rounded-md font-mono font-bold uppercase text-white/95 ring-1 ring-white/12',
          className,
        )}
        style={{ width: size, height: size, background: avatarGradient(symbol), fontSize: Math.max(10, size * 0.28) }}
        aria-hidden
      >
        {initialsFor(symbol)}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      className={cn('shrink-0 rounded-md object-cover ring-1 ring-white/10', className)}
      style={{ width: size, height: size }}
      onError={() => setIdx((i) => i + 1)}
    />
  );
}
