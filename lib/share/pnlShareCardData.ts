import type { PnlShareCalendarDay, PnlSharePayload, ShareOverlaySettings, ShareBackgroundPresetId } from '@/lib/share/types';
import type { WalletAnalyticsTimeframe } from '@/lib/wallet-analytics/types';
import { formatCompactUsd, formatSol } from '@/lib/utils/formatters';
import type { MonthPnlSummary } from '@/lib/portfolio/dailyPnlCalendar';

export type PointerPnLShareCardData = {
  username: string;
  periodLabel: string;
  pnlAmount: string;
  pnlToken: 'SOL' | 'USD';
  pnlPercent: string | null;
  totalBought: string;
  totalSold: string;
  calendarDays: PnlShareCalendarDay[];
  showCalendar: boolean;
  showFooterBranding: boolean;
  showLogo: boolean;
  themeVariant: ShareBackgroundPresetId;
  positive: boolean;
};

const TF_LABEL: Record<WalletAnalyticsTimeframe, string> = {
  '1d': '1D Realized',
  '7d': '7D Realized',
  '30d': '30D Realized',
  max: 'ALL Realized',
};

function timeframeLabel(tf: WalletAnalyticsTimeframe): string {
  return TF_LABEL[tf] ?? 'Realized';
}

function fmtSignedUsd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return v >= 0 ? `+${formatCompactUsd(v)}` : formatCompactUsd(v);
}

function fmtSignedSol(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  const sign = v >= 0 ? '+' : '-';
  return `${sign}${formatSol(Math.abs(v))}`;
}

function fmtPct(v: number | null | undefined): string | null {
  if (v == null || !Number.isFinite(v)) return null;
  return `${v >= 0 ? '+' : ''}${v.toFixed(v >= 100 || v <= -100 ? 0 : 2)}%`;
}

export function buildMonthlyCalendarDays(
  summary: MonthPnlSummary,
  currency: 'usd' | 'sol',
  maxDays = 7,
): PnlShareCalendarDay[] {
  const weekday = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  const entries = [...summary.daily.entries()]
    .filter(([, d]) => d.pnlUsd !== 0 || d.pnlSol !== 0)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-maxDays);

  return entries.map(([key, d]) => {
    const parts = key.split('-');
    const dayNum = Number(parts[2]) || 0;
    const date = new Date(`${key}T12:00:00Z`);
    const pnl = currency === 'sol' ? d.pnlSol : d.pnlUsd;
    const positive = pnl >= 0;
    const value =
      currency === 'sol'
        ? `${positive ? '+' : '-'}${formatSol(Math.abs(pnl))}`
        : positive
          ? `+${formatCompactUsd(pnl)}`
          : formatCompactUsd(pnl);
    return {
      label: weekday[date.getUTCDay()] ?? 'D',
      day: dayNum,
      value,
      positive,
    };
  });
}

export function payloadToShareCardData(params: {
  payload: PnlSharePayload;
  overlay: ShareOverlaySettings;
  backgroundId: ShareBackgroundPresetId;
  amountPrimary?: string | null;
  referralCode?: string | null;
  headlineText?: string | null;
  chainTicker?: 'SOL' | 'USD';
  solUsd?: number | null;
  shareKind?: 'position' | 'monthly';
  shareHeader?: string | null;
}): PointerPnLShareCardData {
  const {
    payload,
    overlay,
    backgroundId,
    amountPrimary,
    referralCode,
    headlineText,
    chainTicker = 'USD',
    solUsd,
    shareKind = 'position',
    shareHeader,
  } = params;

  const rawHandle =
    (referralCode || 'pointer').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 18) || 'pointer';
  const username = `@${rawHandle}`;

  const periodLabel =
    shareKind === 'monthly' && shareHeader
      ? `${shareHeader} Realized`
      : headlineText?.trim()
        ? headlineText.trim().slice(0, 48)
        : timeframeLabel(payload.timeframe);

  const pos = payload.pnlUsd != null && payload.pnlUsd >= 0;

  let pnlAmount = '—';
  let pnlToken: 'SOL' | 'USD' = chainTicker;
  if (amountPrimary) {
    const parts = amountPrimary.trim().split(/\s+/);
    if (parts.length >= 2 && /SOL|USD/i.test(parts[parts.length - 1]!)) {
      const tok = parts[parts.length - 1]!.toUpperCase();
      pnlToken = tok === 'SOL' ? 'SOL' : 'USD';
      pnlAmount = parts.slice(0, -1).join(' ');
    } else {
      pnlAmount = amountPrimary;
    }
  } else if (payload.pnlUsd != null) {
    pnlAmount = fmtSignedUsd(payload.pnlUsd);
    pnlToken = 'USD';
  }

  const rate = solUsd != null && solUsd > 0 ? solUsd : null;

  let totalBought = '—';
  let totalSold = '—';
  if (chainTicker === 'SOL' && rate != null) {
    totalBought =
      payload.investedUsd != null ? fmtSignedSol(payload.investedUsd / rate).replace(/^[+-]/, '') : '—';
    totalSold =
      payload.positionUsd != null ? fmtSignedSol(payload.positionUsd / rate).replace(/^[+-]/, '') : '—';
    if (totalBought !== '—') totalBought = `${totalBought} SOL`;
    if (totalSold !== '—') totalSold = `${totalSold} SOL`;
  } else {
    totalBought =
      payload.investedUsd != null ? formatCompactUsd(payload.investedUsd) : '—';
    totalSold =
      payload.positionUsd != null ? formatCompactUsd(payload.positionUsd) : '—';
    if (totalBought !== '—') totalBought = `${totalBought}`;
    if (totalSold !== '—') totalSold = `${totalSold}`;
  }

  const calendarDays = payload.calendarDays ?? [];
  const showCalendar = calendarDays.length > 0;

  return {
    username,
    periodLabel,
    pnlAmount,
    pnlToken,
    pnlPercent: fmtPct(payload.pnlPct),
    totalBought,
    totalSold,
    calendarDays,
    showCalendar,
    showFooterBranding: overlay.showBranding,
    showLogo: overlay.showBranding,
    themeVariant: backgroundId,
    positive: pos,
  };
}
