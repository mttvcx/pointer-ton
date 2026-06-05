'use client';

import { useEffect } from 'react';
import type { PackReward } from '@/types/pack';
import { usePackCelebrationSound } from '@/components/packs/usePackCelebrationSound';
import { JACKPOT_HELI_SEQUENCE_MS } from '@/lib/packs/celebrations';
import { HelicopterBlackhawkSvg } from '@/components/packs/HelicopterBlackhawkSvg';
import { PackJackpotMegaFx } from '@/components/packs/PackJackpotMegaFx';
import { PackRewardCard } from '@/components/packs/PackRewardCard';

type PackHelicopterRevealProps = {
  reward: PackReward;
  onComplete: () => void;
};

/** Mythic 0.01% — heli winches the card up from below the floor (heavy pull). */
export function PackHelicopterReveal({ reward, onComplete }: PackHelicopterRevealProps) {
  usePackCelebrationSound('helicopter');

  useEffect(() => {
    const t = setTimeout(onComplete, JACKPOT_HELI_SEQUENCE_MS);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div
      className="pack-jackpot-scene relative h-full min-h-0 w-full flex-1 overflow-hidden"
      style={{ ['--pack-jackpot-duration' as string]: `${JACKPOT_HELI_SEQUENCE_MS}ms` }}
    >
      <div className="pack-jackpot-night pointer-events-none absolute inset-0" aria-hidden />
      <div className="pack-jackpot-city pointer-events-none absolute inset-x-0 bottom-[18%] h-[32%]" aria-hidden />
      <div className="pack-jackpot-ground pointer-events-none absolute inset-x-0 bottom-0 h-[22%]" aria-hidden />
      <div className="pack-jackpot-spot pointer-events-none absolute inset-x-0 bottom-[18%] h-[40%]" aria-hidden />
      <div className="pack-jackpot-beam pointer-events-none absolute inset-0" aria-hidden />

      <div className="pack-jackpot-winch-rig">
        <div className="pack-jackpot-heli-head">
          <HelicopterBlackhawkSvg className="h-[min(28vh,220px)] w-[min(92vw,720px)] sm:h-[min(32vh,260px)] sm:w-[min(94vw,820px)]" />
        </div>
        <div className="pack-jackpot-tether">
          <div className="pack-jackpot-cable" aria-hidden />
          <div className="pack-jackpot-hook" aria-hidden />
          <div className="pack-jackpot-card-mount">
            <PackRewardCard reward={reward} revealed settled insane />
          </div>
        </div>
      </div>

      <div className="pack-jackpot-rise-dust pointer-events-none absolute inset-x-0 bottom-[16%] h-[28%]" aria-hidden />
      <div className="pack-jackpot-rise-dust pack-jackpot-rise-dust--2 pointer-events-none absolute inset-x-0 bottom-[14%] h-[24%]" aria-hidden />

      <PackJackpotMegaFx active />
    </div>
  );
}
