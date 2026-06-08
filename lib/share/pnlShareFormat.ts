import type { WalletAnalyticsTimeframe } from '@/lib/wallet-analytics/types';
import { formatCompactUsd } from '@/lib/utils/formatters';

const TF_LABEL: Record<WalletAnalyticsTimeframe, string> = {
  '1d': '1D',
  '7d': '7D',
  '30d': '30D',
  max: 'ALL',
};

/** Whole SOL only — no decimals on share cards. */
export function formatShareSolInteger(value: number, withSign = true): string {
  const rounded = Math.round(Math.abs(value));
  const body = rounded.toLocaleString('en-US');
  if (!withSign) return body;
  return value >= 0 ? `+${body}` : `-${body}`;
}

export function formatShareSolAmount(value: number): string {
  return `${formatShareSolInteger(value)} SOL`;
}

export function formatShareUsdAmount(value: number): string {
  return value >= 0 ? `+${formatCompactUsd(value)}` : formatCompactUsd(value);
}

/** Shrink hero type so amount + token stay on one line inside the glass box. */
export function fitShareHeroFontSize(
  amount: string,
  token: string | null,
  baseSize: number,
): number {
  const len = amount.length + (token ? token.length + 2 : 0);
  if (len <= 11) return baseSize;
  if (len <= 14) return Math.round(baseSize * 0.92);
  if (len <= 17) return Math.round(baseSize * 0.84);
  if (len <= 20) return Math.round(baseSize * 0.76);
  if (len <= 24) return Math.round(baseSize * 0.68);
  return Math.round(baseSize * 0.6);
}

export function sharePeriodHeadline(
  shareKind: 'position' | 'monthly',
  shareHeader: string | null | undefined,
  timeframe: WalletAnalyticsTimeframe,
): string {
  if (shareKind === 'monthly' && shareHeader?.trim()) {
    const trimmed = shareHeader.trim();
    const match = trimmed.match(/^([A-Za-z]+)\s+(\d{4})$/);
    if (match) {
      return `${match[1]!.slice(0, 3).toUpperCase()} ${match[2]} REALIZED`;
    }
    return `${trimmed.toUpperCase()} REALIZED`;
  }
  const tf = TF_LABEL[timeframe] ?? '30D';
  return `${tf} REALIZED`;
}

export function shareUsernameHandle(
  walletLabel: string | null | undefined,
  referralCode: string | null | undefined,
): string {
  const raw = (walletLabel?.trim() || referralCode?.trim() || '')
    .replace(/^@/, '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 20);
  if (!raw) return '@pointer';
  return `@${raw.toLowerCase()}`;
}
