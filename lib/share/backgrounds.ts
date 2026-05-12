import type { ShareBackgroundPresetId } from '@/lib/share/types';

/**
 * Restrained Pointer share backgrounds. Each preset is intentionally bland —
 * the hero PNL number and neon Pointer bird carry the visual weight.
 */
export const PRESET_BACKGROUNDS: {
  id: ShareBackgroundPresetId;
  label: string;
  className: string;
  /** Tint for the bird halo + faded POINTER wordmark per preset */
  birdGlow: 'violet' | 'cyan' | 'mono';
  /** Tone of the faded POINTER backdrop wordmark */
  wordmarkTone: 'violet' | 'cyan' | 'slate';
}[] = [
  {
    id: 'midnight',
    label: 'Midnight',
    className:
      'bg-[#05070d] ' +
      '[background-image:radial-gradient(900px_540px_at_82%_42%,rgba(124,58,237,0.28),transparent_60%),radial-gradient(640px_360px_at_20%_85%,rgba(67,32,176,0.18),transparent_60%),linear-gradient(180deg,#05070d,#04060b)]',
    birdGlow: 'violet',
    wordmarkTone: 'violet',
  },
  {
    id: 'onyx',
    label: 'Onyx',
    className:
      'bg-[#04060a] ' +
      '[background-image:radial-gradient(820px_460px_at_78%_50%,rgba(255,255,255,0.06),transparent_60%),linear-gradient(180deg,#04060a,#020306)]',
    birdGlow: 'mono',
    wordmarkTone: 'slate',
  },
  {
    id: 'glacier',
    label: 'Glacier',
    className:
      'bg-[#04080d] ' +
      '[background-image:radial-gradient(880px_500px_at_78%_45%,rgba(34,211,238,0.22),transparent_60%),radial-gradient(640px_360px_at_18%_82%,rgba(14,116,144,0.16),transparent_60%),linear-gradient(180deg,#04080d,#03060a)]',
    birdGlow: 'cyan',
    wordmarkTone: 'cyan',
  },
];

export const DEFAULT_BACKGROUND_ID: ShareBackgroundPresetId = 'midnight';

export function presetClass(id: ShareBackgroundPresetId): string {
  const fallback = PRESET_BACKGROUNDS[0]?.className ?? '';
  return PRESET_BACKGROUNDS.find((p) => p.id === id)?.className ?? fallback;
}

export function presetMeta(id: ShareBackgroundPresetId) {
  return PRESET_BACKGROUNDS.find((p) => p.id === id) ?? PRESET_BACKGROUNDS[0]!;
}
