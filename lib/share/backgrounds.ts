import type { ShareBackgroundPresetId } from '@/lib/share/types';

export const PRESET_BACKGROUNDS: {
  id: ShareBackgroundPresetId;
  label: string;
  className: string;
}[] = [
  {
    id: 'dark-glass',
    label: 'Dark Glass',
    className:
      'bg-gradient-to-br from-[#04070c] via-[#0a1019] to-[#05080e] ' +
      '[box-shadow:inset_0_1px_0_rgba(255,255,255,0.06),inset_0_-40px_80px_rgba(45,212,191,0.06)]',
  },
  {
    id: 'crystal',
    label: 'Crystal',
    className:
      'bg-gradient-to-b from-[#0b0614] via-[#080a12] to-[#020204] ' +
      '[background-image:radial-gradient(900px_420px_at_20%_0%,rgba(124,58,237,0.32),transparent),radial-gradient(600px_300px_at_90%_30%,rgba(59,130,246,0.18),transparent)]',
  },
  {
    id: 'terminal-glow',
    label: 'Terminal Glow',
    className:
      'bg-[#05070c] bg-[radial-gradient(900px_520px_at_50%_110%,rgba(45,212,191,0.14),transparent)]',
  },
];

export function presetClass(id: ShareBackgroundPresetId): string {
  const fallback = PRESET_BACKGROUNDS[0]?.className ?? '';
  return PRESET_BACKGROUNDS.find((p) => p.id === id)?.className ?? fallback;
}
