import type { CalendarCurrency } from '@/lib/portfolio/dailyPnlCalendar';

export const LS_PNL_CALENDAR_CURRENCY = 'pointer.pnlCalendar.currency.v1';

export function loadCalendarCurrency(fallback: CalendarCurrency): CalendarCurrency {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(LS_PNL_CALENDAR_CURRENCY);
    if (raw === 'usd' || raw === 'sol') return raw;
  } catch {
    /* quota / private mode */
  }
  return fallback;
}

export function saveCalendarCurrency(currency: CalendarCurrency): void {
  try {
    localStorage.setItem(LS_PNL_CALENDAR_CURRENCY, currency);
  } catch {
    /* quota */
  }
}
