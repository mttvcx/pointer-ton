'use client';

import { ShieldCheck } from 'lucide-react';
import type { EthosLevel, EthosProfileSnapshot } from '@/lib/ethos/types';
import { ethosLevelLabel, ethosLevelTone } from '@/lib/ethos/score';
import { cn } from '@/lib/utils/cn';

/**
 * Compact, reusable Ethos credibility badge.
 *
 * Used in:
 *  - Trader Profile Drawer header
 *  - Discover Squads / Trusted Operators cards
 *  - Wallet intel + top-traders rows (when we know an off-chain identity)
 *
 * Design rules:
 *  - One row, never wraps.
 *  - Always includes the level word so the score number isn't load-bearing.
 *  - Falls back to "Unknown" without breaking layout.
 *  - Uses *existing* Tailwind tokens — no new colors invented.
 */
export function EthosBadge({
  profile,
  size = 'sm',
  showScore = true,
  className,
}: {
  profile: EthosProfileSnapshot | null | undefined;
  size?: 'xs' | 'sm' | 'md';
  showScore?: boolean;
  className?: string;
}) {
  const level: EthosLevel = profile?.level ?? 'unknown';
  const tone = ethosLevelTone(level);
  const sizing =
    size === 'xs'
      ? 'h-[18px] px-1.5 text-[9.5px] gap-1'
      : size === 'md'
        ? 'h-7 px-2.5 text-[11.5px] gap-1.5'
        : 'h-[22px] px-2 text-[10.5px] gap-1';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-md font-semibold uppercase tracking-[0.06em] ring-1 ring-inset',
        sizing,
        tone.fill,
        tone.ring,
        tone.text,
        className,
      )}
      title={profile ? `Ethos · ${ethosLevelLabel(level)} (${Math.round(profile.score)})` : 'Ethos · Unknown'}
    >
      <ShieldCheck className={size === 'md' ? 'h-3.5 w-3.5' : 'h-3 w-3'} strokeWidth={2.2} />
      <span>{ethosLevelLabel(level)}</span>
      {showScore && profile ? (
        <span className="ml-0.5 tabular-nums font-semibold opacity-80">{Math.round(profile.score)}</span>
      ) : null}
    </span>
  );
}
