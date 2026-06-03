'use client';

import { useEffect } from 'react';
import type { PackReward } from '@/types/pack';
import { PackRewardCard } from '@/components/packs/PackRewardCard';

const VAULT_OPEN_MS = 8_500;

type PackVaultOpenRevealProps = {
  reward: PackReward;
  onComplete: () => void;
};

const RIVET_POSITIONS = [
  '8% 10%',
  '28% 10%',
  '48% 10%',
  '68% 10%',
  '88% 10%',
  '8% 90%',
  '28% 90%',
  '48% 90%',
  '68% 90%',
  '88% 90%',
] as const;

/** Legendary elite — bank vault dial, doors swing, dolly into room, card on pedestal. */
export function PackVaultOpenReveal({ reward, onComplete }: PackVaultOpenRevealProps) {
  useEffect(() => {
    const t = setTimeout(onComplete, VAULT_OPEN_MS);
    return () => clearTimeout(t);
  }, [onComplete]);

  return (
    <div className="pack-vault-open-scene relative h-full min-h-[min(78vh,640px)] w-full overflow-hidden">
      <div className="pack-vault-open-void pointer-events-none absolute inset-0" aria-hidden />

      <div className="pack-vault-stage">
        <div className="pack-vault-corridor" aria-hidden />

        <div className="pack-vault-camera">
          <div className="pack-vault-door-assembly">
            <div className="pack-vault-steel-frame" aria-hidden />

            <div className="pack-vault-interior-room">
              <div className="pack-vault-deposit-wall" aria-hidden />
              <div className="pack-vault-room-light" aria-hidden />
              <div className="pack-vault-room-floor" aria-hidden />
              <div className="pack-vault-pedestal">
                <div className="pack-vault-pedestal-base" aria-hidden />
                <div className="pack-vault-pedestal-top" aria-hidden />
                <div className="pack-vault-pedestal-glow" aria-hidden />
              </div>
            </div>

            <div className="pack-vault-door pack-vault-door--left">
              {RIVET_POSITIONS.map((pos) => (
                <span key={pos} className="pack-vault-rivet" style={{ left: pos.split(' ')[0], top: pos.split(' ')[1] }} />
              ))}
              <div className="pack-vault-door-plate" aria-hidden />
            </div>

            <div className="pack-vault-door pack-vault-door--right">
              {RIVET_POSITIONS.map((pos) => (
                <span key={`r-${pos}`} className="pack-vault-rivet" style={{ left: pos.split(' ')[0], top: pos.split(' ')[1] }} />
              ))}
              <div className="pack-vault-door-plate" aria-hidden />
            </div>

            <div className="pack-vault-dial-housing" aria-hidden>
              <div className="pack-vault-dial-ring" />
              <div className="pack-vault-dial-wheel">
                <span className="pack-vault-dial-notch" />
                <span className="pack-vault-dial-notch pack-vault-dial-notch--2" />
                <span className="pack-vault-dial-notch pack-vault-dial-notch--3" />
                <span className="pack-vault-dial-notch pack-vault-dial-notch--4" />
              </div>
              <div className="pack-vault-dial-hub" />
            </div>

            <div className="pack-vault-lock-bar" aria-hidden />
            <div className="pack-vault-seam-glow" aria-hidden />
          </div>
        </div>

        <div className="pack-vault-open-boom pointer-events-none absolute inset-0" aria-hidden />

        <div className="pack-vault-card-reveal">
          <PackRewardCard reward={reward} revealed settled insane spotlight />
        </div>
      </div>
    </div>
  );
}
