import type { ShareBackgroundPresetId } from '@/lib/share/types';

export const PNL_SHARE_POS_COLOR = '#e8e8ec';
export const PNL_SHARE_NEG_COLOR = '#c4a0a8';

export type ShareCardTheme = {
  id: ShareBackgroundPresetId;
  label: string;
  accent: string;
  accentMuted: string;
  heroBoxBorder: string;
  heroBoxGlow: string;
  previewGradient: string;
};

export const SHARE_CARD_THEMES: ShareCardTheme[] = [
  {
    id: 'midnight',
    label: 'Chrome',
    accent: '#f0f0f4',
    accentMuted: '#c8c8d0',
    heroBoxBorder: 'rgba(255,255,255,0.35)',
    heroBoxGlow: 'rgba(255,255,255,0.12)',
    previewGradient:
      'linear-gradient(145deg, #000 0%, #0a0a0a 50%, #050505 100%), radial-gradient(ellipse 60% 40% at 30% 20%, rgba(255,255,255,0.12), transparent)',
  },
  {
    id: 'onyx',
    label: 'Mono',
    accent: '#e2e8f0',
    accentMuted: '#94a3b8',
    heroBoxBorder: 'rgba(148,163,184,0.42)',
    heroBoxGlow: 'rgba(148,163,184,0.14)',
    previewGradient:
      'linear-gradient(145deg, #000 0%, #0f0f0f 50%, #050505 100%), radial-gradient(ellipse 55% 38% at 70% 30%, rgba(148,163,184,0.15), transparent)',
  },
  {
    id: 'glacier',
    label: 'Ice',
    accent: '#a5f3fc',
    accentMuted: '#67e8f9',
    heroBoxBorder: 'rgba(103,232,249,0.45)',
    heroBoxGlow: 'rgba(34,211,238,0.18)',
    previewGradient:
      'linear-gradient(145deg, #000 0%, #050a0c 50%, #000 100%), radial-gradient(ellipse 58% 42% at 25% 75%, rgba(103,232,249,0.18), transparent)',
  },
];

export const DEFAULT_SHARE_CARD_THEME_ID: ShareBackgroundPresetId = 'midnight';

export function shareCardTheme(id: ShareBackgroundPresetId): ShareCardTheme {
  return SHARE_CARD_THEMES.find((t) => t.id === id) ?? SHARE_CARD_THEMES[0]!;
}
