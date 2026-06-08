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

export function themeMetallicGradient(id: ShareBackgroundPresetId): string {
  switch (id) {
    case 'glacier':
      return 'linear-gradient(180deg, #f0fdff 0%, #cffafe 18%, #67e8f9 42%, #ecfeff 58%, #22d3ee 78%, #ffffff 100%)';
    case 'onyx':
      return 'linear-gradient(180deg, #f8fafc 0%, #cbd5e1 24%, #94a3b8 48%, #e2e8f0 66%, #64748b 84%, #f1f5f9 100%)';
    default:
      return 'linear-gradient(180deg, #ffffff 0%, #e8e8ec 18%, #a8aab4 42%, #f0f0f4 58%, #8a8c98 78%, #ffffff 100%)';
  }
}

export const THEME_BASE_GRADIENT: Record<ShareBackgroundPresetId, string> = {
  midnight: 'linear-gradient(145deg, #000000 0%, #040404 42%, #0a0a0a 100%)',
  onyx: 'linear-gradient(145deg, #000000 0%, #08080a 40%, #0c0c0e 100%)',
  glacier: 'linear-gradient(145deg, #000203 0%, #020608 42%, #000a0c 100%)',
};

export const THEME_BLOOM_LAYERS: Record<ShareBackgroundPresetId, string> = {
  midnight:
    'radial-gradient(ellipse 55% 45% at 18% 12%, rgba(255,255,255,0.11), transparent 60%), radial-gradient(ellipse 42% 36% at 82% 78%, rgba(200,200,220,0.08), transparent 55%)',
  onyx:
    'radial-gradient(ellipse 52% 42% at 22% 14%, rgba(148,163,184,0.14), transparent 58%), radial-gradient(ellipse 44% 38% at 78% 82%, rgba(100,116,139,0.1), transparent 55%)',
  glacier:
    'radial-gradient(ellipse 58% 46% at 16% 10%, rgba(103,232,249,0.22), transparent 58%), radial-gradient(ellipse 46% 40% at 86% 80%, rgba(34,211,238,0.14), transparent 55%)',
};

export const THEME_STREAK_PRIMARY: Record<ShareBackgroundPresetId, string> = {
  midnight:
    'linear-gradient(105deg, transparent 0%, rgba(255,255,255,0.04) 35%, rgba(255,255,255,0.16) 48%, rgba(200,200,210,0.08) 52%, transparent 68%)',
  onyx:
    'linear-gradient(105deg, transparent 0%, rgba(148,163,184,0.05) 35%, rgba(203,213,225,0.14) 48%, rgba(100,116,139,0.06) 52%, transparent 68%)',
  glacier:
    'linear-gradient(105deg, transparent 0%, rgba(103,232,249,0.06) 35%, rgba(165,243,252,0.18) 48%, rgba(34,211,238,0.08) 52%, transparent 68%)',
};

export const THEME_CURVE_STROKE: Record<ShareBackgroundPresetId, { primary: string; secondary: string }> = {
  midnight: { primary: 'rgba(255,255,255,0.38)', secondary: 'rgba(255,255,255,0.18)' },
  onyx: { primary: 'rgba(148,163,184,0.42)', secondary: 'rgba(148,163,184,0.2)' },
  glacier: { primary: 'rgba(103,232,249,0.45)', secondary: 'rgba(34,211,238,0.22)' },
};
