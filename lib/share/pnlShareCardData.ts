import type {
  PnlShareCalendarDay,
  PnlSharePayload,
  ShareOverlaySettings,
  ShareBackgroundPresetId,
  OverlayAccent,
} from '@/lib/share/types';
import { formatCompactUsd } from '@/lib/utils/formatters';
import { formatShareSolInteger, formatShareUsdAmount } from '@/lib/share/pnlShareFormat';
import type { MonthPnlSummary } from '@/lib/portfolio/dailyPnlCalendar';
import { sharePeriodHeadline, shareUsernameHandle } from '@/lib/share/pnlShareFormat';
import { shortenAddress } from '@/lib/utils/addresses';

export type PointerPnLShareCardData = {
  username: string;
  walletAddressLine: string | null;
  periodLabel: string;
  pnlAmount: string;
  pnlToken: 'SOL' | 'USD';
  pnlPercent: string | null;
  totalBought: string;
  totalSold: string;
  calendarDays: PnlShareCalendarDay[];
  showCalendar: boolean;
  themeVariant: ShareBackgroundPresetId;
  accent: OverlayAccent;
  positive: boolean;
  pnlFormat: ShareOverlaySettings['pnlFormat'];
  overlayAlign: ShareOverlaySettings['overlayAlign'];
};

function fmtSignedUsd(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return formatShareUsdAmount(v);
}

function fmtSolStat(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return '—';
  return `${formatShareSolInteger(v, false)} SOL`;
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
        ? formatShareSolInteger(positive ? pnl : -Math.abs(pnl))
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
    chainTicker = 'USD',
    solUsd,
    shareKind = 'position',
    shareHeader,
  } = params;

  const username = shareUsernameHandle(payload.walletLabel, referralCode);
  const walletAddressLine = overlay.showWalletAddress
    ? shortenAddress(payload.walletAddress, 6)
    : null;

  const periodLabel = sharePeriodHeadline(shareKind, shareHeader, payload.timeframe);
  const pos = payload.pnlUsd != null && payload.pnlUsd >= 0;
  const pctStr = fmtPct(payload.pnlPct);

  let pnlAmount = '—';
  let pnlToken: 'SOL' | 'USD' = chainTicker;
  if (overlay.pnlFormat === 'pct' && pctStr) {
    pnlAmount = pctStr;
    pnlToken = chainTicker;
  } else if (amountPrimary) {
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
    totalBought = payload.investedUsd != null ? fmtSolStat(payload.investedUsd / rate) : '—';
    totalSold = payload.positionUsd != null ? fmtSolStat(payload.positionUsd / rate) : '—';
  } else {
    totalBought = payload.investedUsd != null ? formatCompactUsd(payload.investedUsd) : '—';
    totalSold = payload.positionUsd != null ? formatCompactUsd(payload.positionUsd) : '—';
  }

  const calendarDays = payload.calendarDays ?? [];
  const showCalendar = overlay.showCalendar && calendarDays.length > 0;

  return {
    username,
    walletAddressLine,
    periodLabel,
    pnlAmount,
    pnlToken: overlay.pnlFormat === 'pct' ? chainTicker : pnlToken,
    pnlPercent: pctStr,
    totalBought,
    totalSold,
    calendarDays,
    showCalendar,
    themeVariant: backgroundId,
    accent: overlay.accent,
    positive: pos,
    pnlFormat: overlay.pnlFormat,
    overlayAlign: overlay.overlayAlign,
  };
}
