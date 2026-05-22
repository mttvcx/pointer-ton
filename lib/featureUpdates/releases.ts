/**
 * In-app “what’s new” carousel slides (Axiom-style Feature Updates modal).
 * Swap `imageSrc` when marketing assets land; until then `preview` drives a CSS mock.
 */

export type FeatureUpdatePreview =
  | { kind: 'wallets' }
  | { kind: 'pulse-translate' }
  | { kind: 'pulse-rows' };

export type FeatureUpdateSlide = {
  id: string;
  title: string;
  description: string;
  preview: FeatureUpdatePreview;
  imageSrc?: string;
  imageAlt?: string;
};

export const FEATURE_UPDATE_SLIDES: readonly FeatureUpdateSlide[] = [
  {
    id: 'husher',
    title: 'Husher',
    description: 'Another option for private funding!',
    preview: { kind: 'wallets' },
  },
  {
    id: 'auto-translate',
    title: 'Auto Translate',
    description:
      'English gloss lines for non-Latin token names on Pulse — pick languages, color, and hover behavior.',
    preview: { kind: 'pulse-translate' },
  },
  {
    id: 'pulse-surfaces',
    title: 'Pulse row polish',
    description:
      'Theme-aware row cards, richer icon hovers, and Solscan links on dev migrations.',
    preview: { kind: 'pulse-rows' },
  },
] as const;
