import type { PnlSharePayload } from '@/lib/share/types';
import {
  monthLabel,
  monthPnlPct,
  type CalendarCurrency,
  type MonthPnlSummary,
} from '@/lib/portfolio/dailyPnlCalendar';
import { buildMonthlyCalendarDays } from '@/lib/share/pnlShareCardData';

export type MonthlyPnlSharePayload = {
  year: number;
  month: number;
  currency: CalendarCurrency;
  summary: MonthPnlSummary;
  solUsd: number | null;
  buyVolSol: number;
  sellVolSol: number;
};

const DEFAULT_SOL_USD = 150;

export function monthlyPnlToSharePayload({
  year,
  month,
  summary,
  solUsd,
  buyVolSol,
  sellVolSol,
  currency = 'usd',
}: {
  year: number;
  month: number;
  summary: MonthPnlSummary;
  solUsd: number | null;
  buyVolSol: number;
  sellVolSol: number;
  currency?: CalendarCurrency;
}): PnlSharePayload {
  const rate = solUsd != null && solUsd > 0 ? solUsd : DEFAULT_SOL_USD;
  const label = monthLabel(year, month);
  const [monthPart, yearPart] = label.split(' ');

  return {
    walletAddress: 'monthly-pnl',
    walletLabel: null,
    tokenMint: '',
    tokenTicker: monthPart?.toUpperCase() ?? label.toUpperCase(),
    tokenName: yearPart ? `${yearPart} · Monthly PNL` : 'Monthly PNL',
    tokenIconUrl: null,
    chain: 'sol',
    timeframe: '30d',
    pnlUsd: summary.totalPnlUsd,
    pnlPct: monthPnlPct(summary.totalPnlSol, buyVolSol),
    investedUsd: buyVolSol * rate,
    positionUsd: sellVolSol * rate,
    statInvestedLabel: 'Total Bought',
    statPositionLabel: 'Total Sold',
    calendarDays: buildMonthlyCalendarDays(summary, currency),
  };
}

export function monthlyShareHeaderLabel(year: number, month: number): string {
  return monthLabel(year, month);
}
