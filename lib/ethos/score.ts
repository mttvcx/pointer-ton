import type { EthosLevel } from '@/lib/ethos/types';

/**
 * Ethos score bands. Source: Ethos public docs ("Reputation Score Tiers").
 * Kept here as a single source so the badge UI and Operator Signal math
 * never drift. If Ethos publishes new thresholds, change them once.
 */
export const ETHOS_LEVEL_THRESHOLDS: ReadonlyArray<{
  level: EthosLevel;
  min: number;
}> = [
  { level: 'exemplary', min: 2000 },
  { level: 'reputable', min: 1600 },
  { level: 'neutral', min: 1200 },
  { level: 'questionable', min: 800 },
  { level: 'untrusted', min: -Infinity },
];

export function ethosLevelFromScore(score: number | null | undefined): EthosLevel {
  if (score == null || !Number.isFinite(score)) return 'unknown';
  for (const band of ETHOS_LEVEL_THRESHOLDS) {
    if (score >= band.min) return band.level;
  }
  return 'unknown';
}

export function ethosLevelLabel(level: EthosLevel): string {
  switch (level) {
    case 'exemplary':
      return 'Exemplary';
    case 'reputable':
      return 'Reputable';
    case 'neutral':
      return 'Neutral';
    case 'questionable':
      return 'Questionable';
    case 'untrusted':
      return 'Untrusted';
    case 'unknown':
      return 'Unknown';
    default: {
      const _x: never = level;
      return _x;
    }
  }
}

/**
 * Color tokens are picked from the existing Tailwind palette
 * (`tailwind.config.ts`) so the badge stays on the Pointer
 * dark-terminal aesthetic (no new colors).
 */
export function ethosLevelTone(level: EthosLevel): {
  text: string;
  ring: string;
  fill: string;
} {
  switch (level) {
    case 'exemplary':
      return {
        text: 'text-[#5EBBFF]',
        ring: 'ring-[#5EBBFF]/35',
        fill: 'bg-[#5EBBFF]/10',
      };
    case 'reputable':
      return {
        text: 'text-signal-bull',
        ring: 'ring-signal-bull/35',
        fill: 'bg-signal-bull/10',
      };
    case 'neutral':
      return {
        text: 'text-fg-secondary',
        ring: 'ring-border-strong/45',
        fill: 'bg-white/[0.04]',
      };
    case 'questionable':
      return {
        text: 'text-signal-warn',
        ring: 'ring-signal-warn/35',
        fill: 'bg-signal-warn/10',
      };
    case 'untrusted':
      return {
        text: 'text-signal-bear',
        ring: 'ring-signal-bear/40',
        fill: 'bg-signal-bear/10',
      };
    case 'unknown':
      return {
        text: 'text-fg-muted',
        ring: 'ring-border/50',
        fill: 'bg-white/[0.02]',
      };
    default: {
      const _x: never = level;
      return _x;
    }
  }
}

/**
 * Normalize a score into 0..1 for component-blending in the Operator Signal.
 * Anchored at the Ethos score band edges so the curve matches what users
 * see in the Ethos UI (rather than a raw linear stretch).
 */
export function normalizeEthosScore(score: number | null | undefined): number {
  if (score == null || !Number.isFinite(score)) return 0;
  const clamped = Math.max(0, Math.min(2400, score));
  return clamped / 2400;
}
