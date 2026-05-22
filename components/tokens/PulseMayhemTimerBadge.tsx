'use client';

import { Flame } from 'lucide-react';
import { useLiveClock } from '@/lib/hooks/useLiveClock';
import {
  formatMayhemCountdown,
  mayhemCountdownMs,
} from '@/lib/tokens/mayhemMode';
import { cn } from '@/lib/utils/cn';
import type { PulseTokenBundle } from '@/types/tokens';

/** Live 24h Mayhem countdown — Axiom-style red flame chip beside the age label. */
export function PulseMayhemTimerBadge({
  bundle,
  className,
}: {
  bundle: PulseTokenBundle;
  className?: string;
}) {
  const now = useLiveClock();
  const remainingMs = mayhemCountdownMs(bundle, now);

  if (remainingMs == null) return null;

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center gap-0.5 whitespace-nowrap font-medium tabular-nums leading-none text-[#ff4d6a]',
        className,
      )}
      title="Mayhem Mode — 24h agent window"
    >
      <Flame className="h-3 w-3 shrink-0" strokeWidth={2.25} aria-hidden />
      {formatMayhemCountdown(remainingMs)}
    </span>
  );
}
