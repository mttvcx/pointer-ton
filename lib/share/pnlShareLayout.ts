/**
 * Layout locked to `public/branding/pnl-share-card-purple.png` (1536×1024).
 * All positions are design-space pixels — scale via `fitScale = containerWidth / REF.w`.
 */
export const PNL_SHARE_REFERENCE_IMG = '/branding/pnl-share-card-purple.png';

export const PNL_SHARE_CARD_REF = { w: 1536, h: 1024 } as const;

/** Erase only baked sample text — keep pill borders, hero box, bird, grid from the PNG. */
export const PNL_SHARE_COVER = {
  headline: { x: 96, y: 244, w: 440, h: 44, color: 'rgba(5,2,10,0.92)' },
  ticker: { x: 66, y: 326, w: 340, h: 128, color: 'rgba(5,0,10,0.92)' },
  tokenName: { x: 70, y: 460, w: 300, h: 42, color: 'rgba(5,0,10,0.9)' },
  heroAmount: { x: 96, y: 545, w: 600, h: 112, color: 'rgba(3,2,6,0.92)' },
  stats: { x: 64, y: 716, w: 480, h: 172, color: 'rgba(5,0,10,0.9)' },
  footerUrl: { x: 64, y: 926, w: 360, h: 38, color: 'rgba(5,0,10,0.9)' },
  footerHandle: { x: 1276, y: 924, w: 214, h: 52, color: 'rgba(5,0,10,0.9)' },
} as const;

export const PNL_SHARE_POS = {
  headline: { x: 108, y: 250, maxW: 540 },
  ticker: { x: 76, y: 330, fontSize: 110 },
  tokenName: { x: 80, y: 462, fontSize: 22 },
  heroAmount: { x: 108, y: 556, fontSize: 92 },
  stats: { x: 76, y: 724, fontSize: 22, rowH: 30, labelGap: 120 },
  footerUrl: { x: 104, y: 932, fontSize: 15 },
  footerHandle: { x: 1478, y: 930, fontSize: 30, align: 'right' as const },
} as const;

/** CSS filter applied to the reference PNG for alternate presets. */
export const PNL_SHARE_PRESET_FILTERS: Record<string, string | undefined> = {
  midnight: undefined,
  onyx: 'grayscale(1) brightness(0.82) contrast(1.08)',
  glacier: 'hue-rotate(148deg) saturate(1.35) brightness(0.92)',
};
