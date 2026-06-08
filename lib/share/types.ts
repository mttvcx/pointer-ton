import type { AppChainId } from '@/lib/chains/appChain';
import type { WalletAnalyticsTimeframe } from '@/lib/wallet-analytics/types';

export type ShareMode = 'image' | 'video';

export type ShareBackgroundPresetId = 'midnight' | 'onyx' | 'glacier';

export type PnlFormatMode = 'amount' | 'pct' | 'both';

export type OverlayAccent = 'teal' | 'purple' | 'blue' | 'green';

export type ShareOverlaySettings = {
  showWalletAddress: boolean;
  /** Monthly calendar panel — only shown when calendar data exists. */
  showCalendar: boolean;
  pnlFormat: PnlFormatMode;
  /** Card darkness / glass strength, 0–1 */
  overlayOpacity: number;
  /** 0.85 – 1.2 */
  textScale: number;
  accent: OverlayAccent;
  overlayAlign: 'left' | 'center' | 'right';
};

export const DEFAULT_SHARE_OVERLAY: ShareOverlaySettings = {
  showWalletAddress: false,
  showCalendar: true,
  pnlFormat: 'both',
  overlayOpacity: 0.48,
  textScale: 1,
  accent: 'teal',
  overlayAlign: 'left',
};

/** Migrate persisted overlay JSON from older composer versions. */
export function normalizeShareOverlay(raw: unknown): ShareOverlaySettings {
  if (!raw || typeof raw !== 'object') return DEFAULT_SHARE_OVERLAY;
  const o = raw as Record<string, unknown>;
  return {
    showWalletAddress: typeof o.showWalletAddress === 'boolean' ? o.showWalletAddress : false,
    showCalendar: typeof o.showCalendar === 'boolean' ? o.showCalendar : true,
    pnlFormat:
      o.pnlFormat === 'amount' || o.pnlFormat === 'pct' || o.pnlFormat === 'both'
        ? o.pnlFormat
        : DEFAULT_SHARE_OVERLAY.pnlFormat,
    overlayOpacity:
      typeof o.overlayOpacity === 'number' ? o.overlayOpacity : DEFAULT_SHARE_OVERLAY.overlayOpacity,
    textScale: typeof o.textScale === 'number' ? o.textScale : DEFAULT_SHARE_OVERLAY.textScale,
    accent:
      o.accent === 'teal' ||
      o.accent === 'purple' ||
      o.accent === 'blue' ||
      o.accent === 'green'
        ? o.accent
        : DEFAULT_SHARE_OVERLAY.accent,
    overlayAlign:
      o.overlayAlign === 'left' || o.overlayAlign === 'center' || o.overlayAlign === 'right'
        ? o.overlayAlign
        : DEFAULT_SHARE_OVERLAY.overlayAlign,
  };
}

export type PnlShareCalendarDay = {
  label: string;
  day: number;
  value: string;
  positive: boolean;
};

export type PnlSharePayload = {
  walletAddress: string;
  walletLabel: string | null;
  tokenMint: string;
  tokenTicker: string;
  tokenName: string | null;
  tokenIconUrl: string | null;
  chain: AppChainId;
  timeframe: WalletAnalyticsTimeframe;
  pnlUsd: number | null;
  pnlPct: number | null;
  investedUsd: number | null;
  positionUsd: number | null;
  realizedUsd?: number | null;
  unrealizedUsd?: number | null;
  /** Override stat row labels (e.g. monthly PNL share). */
  statInvestedLabel?: string;
  statPositionLabel?: string;
  /** Optional daily boxes for PNL calendar module on share card. */
  calendarDays?: PnlShareCalendarDay[];
};

export const SHARE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const SHARE_VIDEO_MAX_BYTES = 25 * 1024 * 1024;
export const SHARE_VIDEO_MAX_DURATION_SEC = 30;
