'use client';

import { cn } from '@/lib/utils/cn';

type EthosWordmarkProps = {
  className?: string;
  height?: number;
};

/** Institutional Ethos geometric mark: vertical spine + three horizontal tiers. */
export function EthosGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 10 10" className={cn('shrink-0', className)} fill="currentColor" aria-hidden>
      <rect x="1.1" y="1.85" width="0.78" height="6.35" rx="0.32" />
      <rect x="1.75" y="1.72" width="6.55" height="0.88" rx="0.22" />
      <rect x="1.75" y="4.55" width="4.55" height="0.88" rx="0.22" />
      <rect x="1.75" y="7.38" width="3.35" height="0.88" rx="0.22" />
    </svg>
  );
}

/**
 * Full wordmark: geometric glyph + serif “Ethos”. Inherits `currentColor` from parent.
 */
export default function EthosWordmark({ className, height = 12 }: EthosWordmarkProps) {
  const g = Math.max(8, Math.round(height * 0.92));
  const padY = Math.max(0, (height - g) / 2);
  const glyphScale = g / 10;
  const textX = g + Math.round(height * 0.28);
  const totalW = textX + Math.round(height * 2.58);
  return (
    <svg
      width={totalW}
      height={height}
      className={cn('block overflow-visible', className)}
      viewBox={`0 0 ${totalW} ${height}`}
      role="img"
      aria-label="Ethos"
    >
      <title>Ethos</title>
      <g transform={`translate(0 ${padY}) scale(${glyphScale.toFixed(4)})`}>
        <rect x="1.1" y="1.85" width="0.78" height="6.35" rx="0.32" />
        <rect x="1.75" y="1.72" width="6.55" height="0.88" rx="0.22" />
        <rect x="1.75" y="4.55" width="4.55" height="0.88" rx="0.22" />
        <rect x="1.75" y="7.38" width="3.35" height="0.88" rx="0.22" />
      </g>
      <text
        x={textX}
        y={Math.round(height * 0.78)}
        fill="currentColor"
        fontSize={Math.round(height * 0.68)}
        fontFamily="Georgia, 'Times New Roman', Times, serif"
        fontWeight={500}
        letterSpacing="-0.02em"
      >
        Ethos
      </text>
    </svg>
  );
}
