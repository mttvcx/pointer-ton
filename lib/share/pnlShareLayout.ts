/**
 * Layout locked to `public/branding/pnl-share-card-purple.png` (1536×1024).
 * All positions are design-space pixels — scale via `fitScale = containerWidth / REF.w`.
 */
export const PNL_SHARE_REFERENCE_IMG = '/branding/pnl-share-card-purple.png';

export const PNL_SHARE_CARD_REF = { w: 1536, h: 1024 } as const;

/** Erase only baked sample text — keep pill borders, hero box, bird, grid from the PNG. */
export const PNL_SHARE_COVER = {
  headline: { x: 92, y: 90, w: 580, h: 26, color: 'rgba(4,2,8,0.88)' },
  ticker: { x: 54, y: 252, w: 280, h: 88, color: 'rgba(5,0,10,0.9)' },
  tokenName: { x: 54, y: 338, w: 240, h: 28, color: 'rgba(5,0,10,0.88)' },
  heroAmount: { x: 88, y: 418, w: 520, h: 72, color: 'rgba(3,2,6,0.92)' },
  stats: { x: 54, y: 536, w: 500, h: 108, color: 'rgba(5,0,10,0.9)' },
  footerUrl: { x: 78, y: 944, w: 260, h: 28, color: 'rgba(5,0,10,0.88)' },
  footerHandle: { x: 1260, y: 932, w: 220, h: 40, color: 'rgba(5,0,10,0.88)' },
} as const;

export const PNL_SHARE_POS = {
  headline: { x: 96, y: 108, maxW: 560 },
  ticker: { x: 58, y: 328, fontSize: 96 },
  tokenName: { x: 58, y: 358, fontSize: 16 },
  heroAmount: { x: 96, y: 472, fontSize: 64 },
  stats: { x: 58, y: 548, fontSize: 15, rowH: 30, labelGap: 48 },
  footerUrl: { x: 82, y: 962, fontSize: 11 },
  footerHandle: { x: 1478, y: 958, fontSize: 28, align: 'right' as const },
} as const;

/** CSS filter applied to the reference PNG for alternate presets. */
export const PNL_SHARE_PRESET_FILTERS: Record<string, string | undefined> = {
  midnight: undefined,
  onyx: 'grayscale(1) brightness(0.82) contrast(1.08)',
  glacier: 'hue-rotate(148deg) saturate(1.35) brightness(0.92)',
};
