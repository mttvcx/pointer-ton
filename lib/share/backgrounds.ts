import type { ShareBackgroundPresetId } from '@/lib/share/types';
import { PNL_SHARE_REFERENCE_IMG } from '@/lib/share/pnlShareLayout';
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
  previewImage: PNL_SHARE_REFERENCE_IMG,
  imageFilter: t.imageFilter,
  birdGlow: BIRD_GLOW[t.id],
  wordmarkTone: WORDMARK_TONE[t.id],
}));

export const DEFAULT_BACKGROUND_ID: ShareBackgroundPresetId = DEFAULT_SHARE_CARD_THEME_ID;

/** PNL tracker widgets — reference card as cover background. */
export function presetClass(id: ShareBackgroundPresetId): string {
  return 'bg-[#05000a] bg-cover bg-center';
}

export function presetBackgroundImage(id: ShareBackgroundPresetId): string {
  return PNL_SHARE_REFERENCE_IMG;
}

export function presetMeta(id: ShareBackgroundPresetId) {
  const t = shareCardTheme(id);
  return {
    id: t.id,
    label: t.label,
    previewImage: t.referenceImage,
    imageFilter: t.imageFilter,
    birdGlow: BIRD_GLOW[t.id],
    wordmarkTone: WORDMARK_TONE[t.id],
  };
}
