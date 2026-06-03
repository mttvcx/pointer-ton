'use client';

import type { PackType } from '@/types/pack';
import { PACK_POINTER_LOGO } from '@/lib/packs/constants';
import { getOpenAnimationProfile } from '@/lib/packs/pullIntensity';
import { PACK_VISUAL } from '@/lib/packs/rarityTheme';
import { cn } from '@/lib/utils/cn';

type PackFoilBoxProps = {
  packType: PackType;
  label: string;
  phase: 'idle' | 'float' | 'shake' | 'burst';
};

export function PackFoilBox({ packType, label, phase }: PackFoilBoxProps) {
  const vis = PACK_VISUAL[packType];
  const profile = getOpenAnimationProfile(packType);

  return (
    <div className="pack-scene relative flex h-[min(52vh,420px)] w-full items-center justify-center overflow-hidden">
      <div className="pack-stage-glow pointer-events-none absolute" aria-hidden />

      <div
        className={cn(
          'pack-foil-box relative',
          profile === 'calm' && phase === 'float' && 'pack-foil-box--float-calm',
          profile !== 'calm' && phase === 'float' && 'pack-foil-box--float',
          phase === 'shake' && profile !== 'calm' && 'pack-foil-box--shake',
          phase === 'burst' && (profile === 'calm' ? 'pack-foil-box--fade-out' : 'pack-foil-box--burst'),
        )}
      >
        {phase === 'burst' && profile !== 'calm' ? (
          <div className="pack-burst-glow pointer-events-none absolute left-1/2 top-1/2 -z-10" aria-hidden />
        ) : null}

        <div
          className={cn(
            'relative flex h-56 w-40 flex-col overflow-hidden rounded-sm border-2 shadow-2xl',
            vis.border,
            vis.glow,
            phase === 'burst' && profile !== 'calm' && 'pack-foil-card--burst',
          )}
        >
          <div className={cn('absolute inset-0 bg-gradient-to-br opacity-95', vis.gradient)} />
          <div className="pack-foil-shine pack-foil-shine--open pointer-events-none absolute inset-0" aria-hidden />
          <div className="relative flex flex-1 flex-col items-center justify-center px-3 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center overflow-hidden rounded-sm border border-white/15 bg-black/30 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={PACK_POINTER_LOGO} alt="" className="h-10 w-10 object-contain" draggable={false} />
            </div>
            <p className={cn('text-[10px] font-bold uppercase tracking-[0.22em]', vis.accent)}>Pointer</p>
            <p className="mt-1 text-lg font-semibold tracking-tight text-white">{label}</p>
            <p className="mt-2 text-[10px] uppercase tracking-[0.16em] text-white/45">Pack</p>
          </div>
          <div className="relative border-t border-white/10 bg-black/30 py-2 text-center text-[9px] font-semibold uppercase tracking-[0.2em] text-white/50">
            Rip to reveal
          </div>
        </div>
      </div>
    </div>
  );
}
