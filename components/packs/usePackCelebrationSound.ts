'use client';

import { useEffect } from 'react';
import {
  startPackCandleSurgeSounds,
  startPackHelicopterSounds,
  startPackJackpotStingSounds,
  startPackVaultSounds,
} from '@/lib/packs/packSounds';

export type PackCelebrationSoundKind = 'jackpot_sting' | 'helicopter' | 'vault' | 'candle_surge';

/** Starts procedural SFX for a pack cinematic; cleans up on unmount. */
export function usePackCelebrationSound(kind: PackCelebrationSoundKind | null): void {
  useEffect(() => {
    if (!kind) return;

    if (kind === 'jackpot_sting') {
      return startPackJackpotStingSounds();
    }

    const stop =
      kind === 'helicopter'
        ? startPackHelicopterSounds()
        : kind === 'vault'
          ? startPackVaultSounds()
          : startPackCandleSurgeSounds();

    return stop;
  }, [kind]);
}
