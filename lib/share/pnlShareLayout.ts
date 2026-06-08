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
  logo: { x: PNL_SHARE_PAD, y: 32, birdSize: 120 },
  wordmark: { right: 80, y: 44, fontSize: 50 },
  periodHeadline: { x: PNL_SHARE_PAD, y: 188, fontSize: 64, lineHeight: 1.05 },
  heroBox: { x: PNL_SHARE_PAD, y: 300, w: 880, h: 148 },
  heroAmount: { fontSize: 96, tokenSize: 48 },
  stats: { x: PNL_SHARE_PAD, y: 492, labelSize: 28, valueSize: 46, rowGap: 46, rowMinH: 56, labelGap: 340 },
  calendar: { x: 960, y: 360, w: 880, h: 620 },
  footerLogo: { x: PNL_SHARE_PAD, y: 832, size: 48 },
  footerHandle: { x: PNL_SHARE_PAD, y: 892, fontSize: 50 },
  footerDomain: { x: PNL_SHARE_PAD, y: 954, fontSize: 42 },
  footerPromo: { x: PNL_SHARE_PAD, y: 1008, fontSize: 38 },
} as const;

export function pnlShareContentOffset(align: 'left' | 'center' | 'right'): number {
  const pad = PNL_SHARE_PAD;
  const colW = PNL_SHARE_CONTENT_W;
  if (align === 'center') return Math.round((PNL_SHARE_CARD_REF.w - colW) / 2);
  if (align === 'right') return PNL_SHARE_CARD_REF.w - colW - pad;
  return pad;
}
