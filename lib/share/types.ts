import type { AppChainId } from '@/lib/chains/appChain';
import type { WalletAnalyticsTimeframe } from '@/lib/wallet-analytics/types';

export type ShareMode = 'image' | 'video';

export type ShareBackgroundPresetId = 'midnight' | 'onyx' | 'glacier';

export type PnlFormatMode = 'amount' | 'pct' | 'both';

export type OverlayAccent = 'teal' | 'purple' | 'blue' | 'green';

export type ShareOverlaySettings = {
  showTokenName: boolean;
  showWalletLabel: boolean;
  showWalletAddress: boolean;
  showBranding: boolean;
  showCashbackFooter: boolean;
  compactStats: boolean;
  pnlFormat: PnlFormatMode;
  /** Dark overlay on background media, 0–1 */
  overlayOpacity: number;
  /** 0.85 – 1.2 */
  textScale: number;
  accent: OverlayAccent;
  overlayAlign: 'left' | 'center' | 'right';
};

export const DEFAULT_SHARE_HEADLINE = '50% CASHBACK, THE HIGHEST IN THE GAME.';
export const MAX_SHARE_HEADLINE_CHARS = 72;

export const DEFAULT_SHARE_OVERLAY: ShareOverlaySettings = {
  showTokenName: true,
  showWalletLabel: true,
  showWalletAddress: false,
  showBranding: true,
  showCashbackFooter: true,
  compactStats: false,
  pnlFormat: 'both',
  overlayOpacity: 0.52,
  textScale: 1,
  accent: 'teal',
  overlayAlign: 'left',
};

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
