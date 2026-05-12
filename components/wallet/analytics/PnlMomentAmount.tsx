'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils/cn';
import {
  PNL_MOMENT_DURATION_SEC,
  pnlMomentSnapshot,
} from '@/lib/share/pnlMomentMotion';
import { formatCompactUsd } from '@/lib/utils/formatters';

export type PnlMomentBasis =
  | { kind: 'usd'; value: number }
  | { kind: 'sol'; value: number };

export function PnlMomentAmount({
  basis,
  fallbackText,
  frozen,
  revealKey,
  positive,
  className,
  style: styleProp,
}: {
  basis: PnlMomentBasis | null;
  fallbackText: string;
  frozen: boolean;
  /** Bumps rAF replay when identity / amount basis changes */
  revealKey: string;
  positive: boolean;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [tSec, setTSec] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);
  const startRef = useRef<number | null>(null);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  useEffect(() => {
    startRef.current = null;
    setTSec(0);
    if (frozen || reducedMotion) return;

    let cancelled = false;
    let raf = 0;

    const loop = (now: number) => {
      if (cancelled) return;
      if (startRef.current == null) startRef.current = now;
      const elapsed = (now - startRef.current) / 1000;
      setTSec(elapsed);
      if (elapsed < PNL_MOMENT_DURATION_SEC + 0.02) {
        raf = requestAnimationFrame(loop);
      }
    };

    raf = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [revealKey, frozen, reducedMotion]);

  const settled = frozen || reducedMotion;
  const snap = settled ? pnlMomentSnapshot(PNL_MOMENT_DURATION_SEC) : pnlMomentSnapshot(tSec);

  let label: string;
  if (basis == null) {
    label = fallbackText;
  } else if (basis.kind === 'usd') {
    const v = basis.value * snap.countProgress;
    label = v >= 0 ? `+${formatCompactUsd(v)}` : formatCompactUsd(v);
  } else {
    const v = basis.value * snap.countProgress;
    const sign = v >= 0 ? '+' : '-';
    label = `${sign}${Math.abs(v).toFixed(3)} SOL`;
  }

  const glowColor = positive ? 'rgba(45,212,191,0.45)' : 'rgba(253,164,175,0.35)';

  return (
    <span className="relative inline-block">
      <span
        className="pointer-events-none absolute left-1/2 top-[48%] h-[140%] w-[min(140%,420px)] -translate-x-1/2 -translate-y-1/2 rounded-full mix-blend-screen"
        style={{
          background: `radial-gradient(circle at 50% 50%, ${glowColor}, transparent 68%)`,
          opacity: snap.glowStrength * 0.85,
        }}
        aria-hidden
      />
      <span
        className={cn('relative inline-block will-change-[transform,opacity,filter]', className)}
        style={{
          ...styleProp,
          transformOrigin: 'center center',
          opacity: snap.opacity,
          transform: `scale(${snap.scale})`,
          filter: snap.blurPx > 0.04 ? `blur(${snap.blurPx}px)` : undefined,
        }}
      >
        {label}
      </span>
    </span>
  );
}
