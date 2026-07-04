/**
 * 16:9 export canvas — design-space pixels scaled via fitScale = containerWidth / REF.w
 */
export const PNL_SHARE_CARD_REF = { w: 1920, h: 1080 } as const;

/** @deprecated reference PNG removed — presets use code-rendered backgrounds */
export const PNL_SHARE_REFERENCE_IMG = '/branding/pnl-share-card-purple.png';

export const PNL_SHARE_PAD = 64;

/** Left content column width — used for overlay position (left/center/right). */
export const PNL_SHARE_CONTENT_W = 860;

export const PNL_SHARE_POS = {
  logo: { x: PNL_SHARE_PAD, y: 28, birdSize: 140 },
  wordmark: { right: 80, y: 40, fontSize: 74 },
  periodHeadline: { x: PNL_SHARE_PAD, y: 190, fontSize: 70, lineHeight: 1.05 },
  heroBox: { x: PNL_SHARE_PAD, y: 300, w: 880, h: 152 },
  heroAmount: { fontSize: 104, tokenSize: 52 },
  stats: { x: PNL_SHARE_PAD, y: 496, labelSize: 30, valueSize: 50, rowGap: 46, rowMinH: 58, labelGap: 340 },
  calendar: { x: 960, y: 360, w: 880, h: 620 },
  footerLogo: { x: PNL_SHARE_PAD, y: 830, size: 52 },
  footerHandle: { x: PNL_SHARE_PAD, y: 890, fontSize: 54 },
  footerDomain: { x: PNL_SHARE_PAD, y: 954, fontSize: 45 },
  footerPromo: { x: PNL_SHARE_PAD, y: 1008, fontSize: 40 },
} as const;

export function pnlShareContentOffset(align: 'left' | 'center' | 'right'): number {
  const pad = PNL_SHARE_PAD;
  const colW = PNL_SHARE_CONTENT_W;
  if (align === 'center') return Math.round((PNL_SHARE_CARD_REF.w - colW) / 2);
  if (align === 'right') return PNL_SHARE_CARD_REF.w - colW - pad;
  return pad;
}
