'use client';

import { useMemo } from 'react';
import type { PackReward } from '@/types/pack';
import { PackRewardCard } from '@/components/packs/PackRewardCard';
import { formatPackVal } from '@/lib/packs/formatDisplay';

type PackMythicShowcaseProps = {
  reward: PackReward;
  onSkip: () => void;
};

/** Post-helicopter PES-style 3D card showcase — holds until click / skip. */
export function PackMythicShowcase({ reward, onSkip }: PackMythicShowcaseProps) {
  const ticker = useMemo(() => {
    const raw = reward.tokenSymbol ?? reward.title;
    return raw.replace(/\s+/g, '').toUpperCase();
  }, [reward.tokenSymbol, reward.title]);

  const valueLabel = formatPackVal(reward.valueUsd, reward.valueSol);

  return (
    <button
      type="button"
      className="pack-mythic-showcase group absolute inset-0 cursor-pointer border-0 bg-black p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-300/50"
      onClick={onSkip}
      aria-label="Continue to pull reveal"
    >
      <div className="pack-mythic-showcase-void pointer-events-none absolute inset-0" aria-hidden />
      <div className="pack-mythic-showcase-streaks pointer-events-none absolute inset-0" aria-hidden />
      <div className="pack-mythic-showcase-streaks pack-mythic-showcase-streaks--alt pointer-events-none absolute inset-0" aria-hidden />
      <div className="pack-mythic-showcase-floor pointer-events-none absolute inset-x-0 bottom-0 h-[38%]" aria-hidden />
      <div className="pack-mythic-showcase-energy pointer-events-none absolute inset-0" aria-hidden />
      <div className="pack-mythic-showcase-flare pointer-events-none absolute inset-0" aria-hidden />

      <div className="pack-mythic-showcase-layout pointer-events-none relative flex h-full w-full items-center justify-center px-[5vw]">
        <div className="pack-mythic-showcase-stage">
          <div className="pack-mythic-showcase-rig">
            <div className="pack-mythic-showcase-frame" aria-hidden />
            <div className="pack-mythic-showcase-card-wrap">
              <PackRewardCard reward={reward} revealed settled insane size="showcase" />
            </div>
          </div>
        </div>

        <div className="pack-mythic-showcase-side flex min-w-0 max-w-[38vw] flex-col justify-center pl-[clamp(1.5rem,4vw,4rem)]">
          <p className="pack-mythic-showcase-tier m-0 font-mono text-[11px] font-bold uppercase tracking-[0.28em] text-amber-200/80">
            Mythic pull
          </p>
          <p className="pack-mythic-showcase-ticker m-0 mt-3 font-mono text-[clamp(2.4rem,6.5vw,4.75rem)] font-black uppercase leading-[0.92] tracking-[0.04em] text-white">
            {ticker}
          </p>
          <p className="pack-mythic-showcase-value m-0 mt-2 font-mono text-[clamp(1.25rem,3.2vw,2.25rem)] font-bold tabular-nums text-amber-300">
            {valueLabel}
          </p>
          <div className="pack-mythic-showcase-stars mt-5 flex gap-1.5" aria-hidden>
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className="pack-mythic-showcase-star" />
            ))}
          </div>
        </div>
      </div>

      <p className="pack-mythic-showcase-hint pointer-events-none absolute bottom-6 left-1/2 -translate-x-1/2 text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45 transition-colors group-hover:text-white/70">
        Click to continue
      </p>
    </button>
  );
}
