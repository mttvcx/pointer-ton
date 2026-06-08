import type { ShareBackgroundPresetId } from '@/lib/share/types';
import {
  DEFAULT_SHARE_CARD_THEME_ID,
  SHARE_CARD_THEMES,
  shareCardTheme,
} from '@/lib/share/shareCardTheme';

const BIRD_GLOW: Record<ShareBackgroundPresetId, 'violet' | 'cyan' | 'mono'> = {
  midnight: 'violet',
  onyx: 'mono',
  glacier: 'cyan',
};

const WORDMARK_TONE: Record<ShareBackgroundPresetId, 'violet' | 'cyan' | 'slate'> = {
  midnight: 'violet',
  onyx: 'slate',
  glacier: 'cyan',
};

export const PRESET_BACKGROUNDS = SHARE_CARD_THEMES.map((t) => ({
  id: t.id,
  label: t.label,
  previewGradient: t.previewGradient,
  birdGlow: BIRD_GLOW[t.id],
  wordmarkTone: WORDMARK_TONE[t.id],
}));

export const DEFAULT_BACKGROUND_ID: ShareBackgroundPresetId = DEFAULT_SHARE_CARD_THEME_ID;

export function presetClass(id: ShareBackgroundPresetId): string {
  void id;
  return 'bg-black';
}

export function presetMeta(id: ShareBackgroundPresetId) {
  const t = shareCardTheme(id);
  return {
    id: t.id,
    label: t.label,
    previewGradient: t.previewGradient,
    birdGlow: BIRD_GLOW[t.id],
    wordmarkTone: WORDMARK_TONE[t.id],
  };
}
