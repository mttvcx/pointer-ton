'use client';

import type { CSSProperties } from 'react';
import type { OverlayAccent, ShareBackgroundPresetId } from '@/lib/share/types';
import { ACCENT_GLOW_RGBA, ACCENT_SOFT_RGBA } from '@/lib/share/accentTokens';
import { shareCardTheme, themeMetallicGradient } from '@/lib/share/shareCardTheme';

export type MetallicVariant = 'hero' | 'title' | 'body' | 'username' | 'stat' | 'wordmark';

export function metallicTextStyle(
  variant: MetallicVariant,
  theme: ShareBackgroundPresetId,
  positive = true,
  accent: OverlayAccent = 'teal',
): CSSProperties {
  const cardTheme = shareCardTheme(theme);
  const accentGlow = ACCENT_GLOW_RGBA[accent];

  const base: CSSProperties = {
    backgroundImage: themeMetallicGradient(theme),
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
  };

  const themeGlow = cardTheme.heroBoxGlow;
  const themeTint = `${cardTheme.accent}55`;

  if (variant === 'hero') {
    return {
      ...base,
      filter: positive ? undefined : 'saturate(0.75) brightness(0.92)',
      textShadow: `0 0 32px ${themeGlow}, 0 0 18px ${themeTint}, 0 0 12px ${accentGlow}, 0 2px 10px rgba(0,0,0,0.75)`,
    };
  }

  if (variant === 'title' || variant === 'wordmark') {
    return {
      ...base,
      textShadow: `0 0 24px ${themeGlow}, 0 0 14px ${themeTint}, 0 1px 4px rgba(0,0,0,0.65)`,
    };
  }

  if (variant === 'username') {
    return {
      ...base,
      fontStyle: 'italic',
      textShadow: `0 0 18px ${themeGlow}, 0 0 10px ${accentGlow}, 0 1px 3px rgba(0,0,0,0.55)`,
    };
  }

  if (variant === 'stat') {
    return {
      ...base,
      textShadow: `0 0 20px ${themeGlow}, 0 0 12px ${themeTint}, 0 0 8px ${accentGlow}, 0 1px 3px rgba(0,0,0,0.5)`,
    };
  }

  return {
    color: cardTheme.accentMuted,
    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
  };
}

export function glassPanelStyle(
  intensity: 'soft' | 'medium' | 'strong' = 'medium',
  accent: OverlayAccent = 'teal',
  theme: ShareBackgroundPresetId = 'midnight',
): CSSProperties {
  const cardTheme = shareCardTheme(theme);
  const opacity = intensity === 'soft' ? 0.05 : intensity === 'strong' ? 0.1 : 0.07;
  const accentSoft = ACCENT_SOFT_RGBA[accent];
  return {
    background: `linear-gradient(135deg, rgba(255,255,255,${opacity + 0.05}) 0%, rgba(255,255,255,${opacity}) 45%, rgba(0,0,0,${opacity + 0.08}) 100%)`,
    backdropFilter: intensity === 'strong' ? 'blur(8px)' : 'blur(6px)',
    WebkitBackdropFilter: intensity === 'strong' ? 'blur(8px)' : 'blur(6px)',
    border: `1px solid ${cardTheme.heroBoxBorder}`,
    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.18), 0 0 40px ${cardTheme.heroBoxGlow}, 0 0 20px ${accentSoft}`,
  };
}
