import type { ShareBackgroundPresetId } from '@/lib/share/types';
import {
  PNL_SHARE_PRESET_FILTERS,
  PNL_SHARE_REFERENCE_IMG,
} from '@/lib/share/pnlShareLayout';

export const PNL_SHARE_POS_COLOR = '#22EEB3';
export const PNL_SHARE_NEG_COLOR = '#FF5E78';

export type ShareCardTheme = {
  id: ShareBackgroundPresetId;
  label: string;
  referenceImage: string;
  imageFilter?: string;
  accent: string;
  accentMuted: string;
  heroBoxBorder: string;
  heroBoxGlow: string;
};

export const SHARE_CARD_THEMES: ShareCardTheme[] = [
  {
    id: 'midnight',
    label: 'Purple',
    referenceImage: PNL_SHARE_REFERENCE_IMG,
    imageFilter: PNL_SHARE_PRESET_FILTERS.midnight,
    accent: '#a78bfa',
    accentMuted: '#c4b5fd',
    heroBoxBorder: 'rgba(125,60,255,0.55)',
    heroBoxGlow: 'rgba(124,58,237,0.28)',
  },
  {
    id: 'onyx',
    label: 'Mono',
    referenceImage: PNL_SHARE_REFERENCE_IMG,
    imageFilter: PNL_SHARE_PRESET_FILTERS.onyx,
    accent: '#cbd5e1',
    accentMuted: '#e2e8f0',
    heroBoxBorder: 'rgba(148,163,184,0.42)',
    heroBoxGlow: 'rgba(148,163,184,0.14)',
  },
  {
    id: 'glacier',
    label: 'Cyan',
    referenceImage: PNL_SHARE_REFERENCE_IMG,
    imageFilter: PNL_SHARE_PRESET_FILTERS.glacier,
    accent: '#67e8f9',
    accentMuted: '#a5f3fc',
    heroBoxBorder: 'rgba(34,211,238,0.5)',
    heroBoxGlow: 'rgba(34,211,238,0.22)',
  },
];

export const DEFAULT_SHARE_CARD_THEME_ID: ShareBackgroundPresetId = 'midnight';

export function shareCardTheme(id: ShareBackgroundPresetId): ShareCardTheme {
  return SHARE_CARD_THEMES.find((t) => t.id === id) ?? SHARE_CARD_THEMES[0]!;
}
