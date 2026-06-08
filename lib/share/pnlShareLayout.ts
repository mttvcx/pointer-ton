/**
 * 16:9 export canvas — design-space pixels scaled via fitScale = containerWidth / REF.w
 */
export const PNL_SHARE_CARD_REF = { w: 1920, h: 1080 } as const;

/** @deprecated reference PNG removed — presets use code-rendered backgrounds */
export const PNL_SHARE_REFERENCE_IMG = '/branding/pnl-share-card-purple.png';

export const PNL_SHARE_POS = {
  logo: { x: 56, y: 44 },
  username: { x: 56, y: 44, right: 56 },
  periodHeadline: { x: 56, y: 128, fontSize: 72 },
  heroBox: { x: 56, y: 210, w: 820, h: 148 },
  heroAmount: { fontSize: 88 },
  stats: { x: 56, y: 400, fontSize: 22, rowGap: 36, labelGap: 280 },
  calendar: { x: 980, y: 420, w: 880, h: 580 },
  footerHandle: { x: 56, y: 980, fontSize: 26 },
  footerBrand: { x: 56, y: 1020, fontSize: 13 },
} as const;
