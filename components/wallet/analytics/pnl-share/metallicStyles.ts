import type { CSSProperties } from 'react';
import type { ShareBackgroundPresetId } from '@/lib/share/types';

export type MetallicVariant = 'hero' | 'title' | 'body' | 'username' | 'stat';

const CHROME_GRADIENT: Record<ShareBackgroundPresetId, string> = {
  midnight:
    'linear-gradient(180deg, #ffffff 0%, #e8e8ec 18%, #a8aab4 42%, #f0f0f4 58%, #8a8c98 78%, #ffffff 100%)',
  onyx:
    'linear-gradient(180deg, #f8fafc 0%, #cbd5e1 25%, #94a3b8 50%, #e2e8f0 72%, #64748b 88%, #f1f5f9 100%)',
  glacier:
    'linear-gradient(180deg, #f0fdff 0%, #cffafe 20%, #67e8f9 45%, #ecfeff 62%, #22d3ee 80%, #ffffff 100%)',
};

const CHROME_SHADOW: Record<ShareBackgroundPresetId, string> = {
  midnight: '0 0 24px rgba(255,255,255,0.35), 0 2px 8px rgba(0,0,0,0.8)',
  onyx: '0 0 20px rgba(226,232,240,0.28), 0 2px 6px rgba(0,0,0,0.75)',
  glacier: '0 0 26px rgba(103,232,249,0.32), 0 2px 8px rgba(0,0,0,0.8)',
};

export function metallicTextStyle(
  variant: MetallicVariant,
  theme: ShareBackgroundPresetId,
  positive = true,
): CSSProperties {
  const base: CSSProperties = {
    backgroundImage: CHROME_GRADIENT[theme],
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
  };

  if (variant === 'hero') {
    return {
      ...base,
      filter: positive ? undefined : 'saturate(0.7) hue-rotate(-8deg)',
      textShadow: CHROME_SHADOW[theme],
    };
  }

  if (variant === 'title') {
    return {
      ...base,
      textShadow: '0 0 18px rgba(255,255,255,0.22), 0 1px 4px rgba(0,0,0,0.6)',
    };
  }

  if (variant === 'username') {
    return {
      ...base,
      fontStyle: 'italic',
      textShadow: '0 0 12px rgba(255,255,255,0.18)',
    };
  }

  if (variant === 'stat') {
    return {
      ...base,
      textShadow: '0 0 10px rgba(255,255,255,0.14)',
    };
  }

  return {
    color: 'rgba(255,255,255,0.72)',
    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
  };
}

export function glassPanelStyle(intensity: 'soft' | 'medium' | 'strong' = 'medium'): CSSProperties {
  const opacity = intensity === 'soft' ? 0.04 : intensity === 'strong' ? 0.12 : 0.08;
  return {
    background: `linear-gradient(135deg, rgba(255,255,255,${opacity + 0.04}) 0%, rgba(255,255,255,${opacity}) 40%, rgba(0,0,0,${opacity + 0.06}) 100%)`,
    backdropFilter: 'blur(12px)',
    WebkitBackdropFilter: 'blur(12px)',
    border: '1px solid rgba(255,255,255,0.22)',
    boxShadow:
      'inset 0 1px 0 rgba(255,255,255,0.18), inset 0 -1px 0 rgba(0,0,0,0.35), 0 0 32px rgba(255,255,255,0.06), 0 8px 32px rgba(0,0,0,0.45)',
  };
}
