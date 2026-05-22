import { formatNumber, formatSol } from '@/lib/utils/formatters';

export type ClosedSellPnlInput = {
  submittedAt: string;
  realizedPnlUsd: number;
  /** FIFO realized PNL in SOL when available. */
  realizedPnlSol?: number;
};

export type CalendarTradeInput = {
  side: 'buy' | 'sell';
  submittedAt: string;
  amountSol: number | null;
  status: string;
};

export type DayActivity = {
  pnlUsd: number;
  pnlSol: number;
  buys: number;
  sells: number;
  buyVolSol: number;
  sellVolSol: number;
};

export type MonthPnlSummary = {
  year: number;
  /** 0-indexed (Date#getMonth). */
  month: number;
  totalPnlUsd: number;
  totalPnlSol: number;
  winDays: number;
  lossDays: number;
  winTotalUsd: number;
  winTotalSol: number;
  /** Sum of negative days (negative number). */
  lossTotalUsd: number;
  lossTotalSol: number;
  /** UTC date key → day rollup. */
  daily: Map<string, DayActivity>;
  currentPositiveStreak: number;
  bestPositiveStreak: number;
};

export type CalendarCurrency = 'usd' | 'sol';

const DEFAULT_SOL_USD = 150;

function utcDateKey(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

function emptyDay(): DayActivity {
  return {
    pnlUsd: 0,
    pnlSol: 0,
    buys: 0,
    sells: 0,
    buyVolSol: 0,
    sellVolSol: 0,
  };
}

function dayKey(year: number, month: number, day: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Bucket closed sells + confirmed trades into UTC calendar days. */
export function aggregateDayActivity(
  closedSells: ClosedSellPnlInput[],
  trades: CalendarTradeInput[],
  solUsd: number | null,
): Map<string, DayActivity> {
  const map = new Map<string, DayActivity>();
  const rate = solUsd != null && solUsd > 0 ? solUsd : DEFAULT_SOL_USD;

  const touch = (key: string): DayActivity => {
    const existing = map.get(key);
    if (existing) return existing;
    const next = emptyDay();
    map.set(key, next);
    return next;
  };

  for (const s of closedSells) {
    const d = new Date(s.submittedAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = utcDateKey(d);
    const row = touch(key);
    row.pnlUsd += s.realizedPnlUsd;
    const pnlSol =
      s.realizedPnlSol != null && Number.isFinite(s.realizedPnlSol)
        ? s.realizedPnlSol
        : s.realizedPnlUsd / rate;
    row.pnlSol += pnlSol;
  }

  for (const t of trades) {
    if (t.status !== 'confirmed') continue;
    const d = new Date(t.submittedAt);
    if (Number.isNaN(d.getTime())) continue;
    const key = utcDateKey(d);
    const row = touch(key);
    const vol = t.amountSol != null && Number.isFinite(t.amountSol) ? t.amountSol : 0;
    if (t.side === 'buy') {
      row.buys += 1;
      row.buyVolSol += vol;
    } else {
      row.sells += 1;
      row.sellVolSol += vol;
    }
  }

  return map;
}

/** @deprecated Use aggregateDayActivity */
export function aggregateDailyPnlFromClosedSells(
  closedSells: ClosedSellPnlInput[],
): Map<string, number> {
  const daily = aggregateDayActivity(closedSells, [], null);
  const out = new Map<string, number>();
  for (const [k, v] of daily) out.set(k, v.pnlUsd);
  return out;
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

function streakFromDay(
  daily: Map<string, DayActivity>,
  year: number,
  month: number,
  startDay: number,
): number {
  let streak = 0;
  for (let day = startDay; day >= 1; day--) {
    const pnl = daily.get(dayKey(year, month, day))?.pnlUsd ?? 0;
    if (pnl > 0) streak += 1;
    else break;
  }
  return streak;
}

function bestPositiveStreakInMonth(
  daily: Map<string, DayActivity>,
  year: number,
  month: number,
): number {
  const total = daysInMonth(year, month);
  let best = 0;
  let run = 0;
  for (let day = 1; day <= total; day++) {
    const pnl = daily.get(dayKey(year, month, day))?.pnlUsd ?? 0;
    if (pnl > 0) {
      run += 1;
      best = Math.max(best, run);
    } else {
      run = 0;
    }
  }
  return best;
}

export function summarizeMonthPnl(
  daily: Map<string, DayActivity>,
  year: number,
  month: number,
  solUsd: number | null,
  now: Date = new Date(),
): MonthPnlSummary {
  const rate = solUsd != null && solUsd > 0 ? solUsd : DEFAULT_SOL_USD;
  const totalDays = daysInMonth(year, month);
  let totalPnlUsd = 0;
  let totalPnlSol = 0;
  let winDays = 0;
  let lossDays = 0;
  let winTotalUsd = 0;
  let winTotalSol = 0;
  let lossTotalUsd = 0;
  let lossTotalSol = 0;

  for (let day = 1; day <= totalDays; day++) {
    const activity = daily.get(dayKey(year, month, day)) ?? emptyDay();
    const pnlUsd = activity.pnlUsd;
    const pnlSol =
      activity.pnlSol !== 0 ? activity.pnlSol : pnlUsd / rate;
    totalPnlUsd += pnlUsd;
    totalPnlSol += pnlSol;
    if (pnlUsd > 0) {
      winDays += 1;
      winTotalUsd += pnlUsd;
      winTotalSol += pnlSol;
    } else if (pnlUsd < 0) {
      lossDays += 1;
      lossTotalUsd += pnlUsd;
      lossTotalSol += pnlSol;
    }
  }

  const isCurrentMonth =
    now.getUTCFullYear() === year && now.getUTCMonth() === month;
  const streakStartDay = isCurrentMonth
    ? Math.min(now.getUTCDate(), totalDays)
    : totalDays;

  return {
    year,
    month,
    totalPnlUsd,
    totalPnlSol,
    winDays,
    lossDays,
    winTotalUsd,
    winTotalSol,
    lossTotalUsd,
    lossTotalSol,
    daily,
    currentPositiveStreak: streakFromDay(daily, year, month, streakStartDay),
    bestPositiveStreak: bestPositiveStreakInMonth(daily, year, month),
  };
}

export function safeStreakDays(value: number): number {
  if (!Number.isFinite(value) || value < 0) return 0;
  return Math.floor(value);
}

export function monthTradeVolumes(
  daily: Map<string, DayActivity>,
  year: number,
  month: number,
): { buyVolSol: number; sellVolSol: number } {
  let buyVolSol = 0;
  let sellVolSol = 0;
  const total = daysInMonth(year, month);
  for (let day = 1; day <= total; day++) {
    const activity = daily.get(dayKey(year, month, day)) ?? emptyDay();
    buyVolSol += activity.buyVolSol;
    sellVolSol += activity.sellVolSol;
  }
  return { buyVolSol, sellVolSol };
}

export function monthPnlPct(totalPnlSol: number, buyVolSol: number): number | null {
  if (!Number.isFinite(buyVolSol) || buyVolSol <= 0) return null;
  if (!Number.isFinite(totalPnlSol)) return null;
  return (totalPnlSol / buyVolSol) * 100;
}

export function dayHasActivity(activity: DayActivity): boolean {
  return (
    activity.pnlUsd !== 0 ||
    activity.buys > 0 ||
    activity.sells > 0 ||
    activity.buyVolSol > 0 ||
    activity.sellVolSol > 0
  );
}

export function formatCalendarPnlUsd(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '$0';
  const abs = Math.abs(value);
  const sign = value > 0 ? '+' : '-';
  if (abs < 1_000) {
    return `${sign}$${abs.toFixed(abs >= 100 ? 0 : 2)}`;
  }
  const compact = new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 2,
  }).format(abs);
  return `${sign}$${compact}`;
}

export function formatCalendarPnlSol(value: number): string {
  if (!Number.isFinite(value) || value === 0) return '0';
  const abs = Math.abs(value);
  const sign = value > 0 ? '+' : '-';
  if (abs >= 100) return `${sign}${formatNumber(abs, { decimals: 1 })}`;
  if (abs >= 1) return `${sign}${formatNumber(abs, { decimals: 2 })}`;
  return `${sign}${formatSol(abs)}`;
}

export function formatCalendarPnl(
  activity: DayActivity,
  currency: CalendarCurrency,
  solUsd: number | null,
): string {
  const rate = solUsd != null && solUsd > 0 ? solUsd : DEFAULT_SOL_USD;
  if (currency === 'usd') return formatCalendarPnlUsd(activity.pnlUsd);
  const sol = activity.pnlSol !== 0 ? activity.pnlSol : activity.pnlUsd / rate;
  return formatCalendarPnlSol(sol);
}

export function formatCalendarTotal(
  summary: MonthPnlSummary,
  currency: CalendarCurrency,
): string {
  if (currency === 'usd') return formatCalendarPnlUsd(summary.totalPnlUsd);
  return formatCalendarPnlSol(summary.totalPnlSol);
}

export function formatCalendarSideTotal(
  valueUsd: number,
  valueSol: number,
  currency: CalendarCurrency,
): string {
  if (currency === 'usd') return formatCalendarPnlUsd(valueUsd);
  return formatCalendarPnlSol(valueSol);
}

export function monthLabel(year: number, month: number): string {
  return new Date(Date.UTC(year, month, 1)).toLocaleDateString('en-US', {
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function dayHoverLabel(year: number, month: number, day: number): string {
  return new Date(Date.UTC(year, month, day)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/** Monday-first weekday index (0 = Mon … 6 = Sun). */
export function mondayFirstWeekdayIndex(year: number, month: number): number {
  const dow = new Date(Date.UTC(year, month, 1)).getUTCDay();
  return dow === 0 ? 6 : dow - 1;
}
