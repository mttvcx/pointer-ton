'use client';

import type { PackType } from '@/types/pack';
import { getOpenAnimationProfile } from '@/lib/packs/pullIntensity';
import { PackFoilDesign } from '@/components/packs/PackFoilDesign';
import { cn } from '@/lib/utils/cn';

type PackFoilBoxProps = {
  packType: PackType;
  label: string;
  phase: 'idle' | 'float' | 'shake' | 'burst';
};

export function PackFoilBox({ packType, label, phase }: PackFoilBoxProps) {
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

        <div className={cn(phase === 'burst' && profile !== 'calm' && 'pack-foil-card--burst')}>
          <div className="relative h-72 w-52">
            <PackFoilDesign type={packType} label={label} variant="open" />
          </div>
        </div>
      </div>
    </div>
  );
}
