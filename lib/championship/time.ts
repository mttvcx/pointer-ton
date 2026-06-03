import {
  CHAMPIONSHIP_REGIONS,
  CHAMPIONSHIP_REGION_STORAGE_KEY,
  PTCS_REVIEW_WINDOW_HOURS,
  PTCS_SEASON,
} from '@/lib/championship/config';
import type { ChampionshipEvent, ChampionshipEventStatus, ChampionshipRegion } from '@/lib/championship/types';

type ZonedParts = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
  weekday: number;
};

function parseParts(date: Date, timeZone: string): ZonedParts {
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
    weekday: 'short',
  });
  const parts = fmt.formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? 0);
  const wd = parts.find((p) => p.type === 'weekday')?.value ?? 'Mon';
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    hour: get('hour'),
    minute: get('minute'),
    second: get('second'),
    weekday: weekdayMap[wd] ?? 1,
  };
}

/** Approximate zoned instant from components (good enough for cup boundaries). */
function zonedToUtc(
  year: number,
  month: number,
  day: number,
  hour: number,
  minute: number,
  second: number,
  timeZone: string,
): Date {
  const guess = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const asZoned = parseParts(guess, timeZone);
  const targetMs = Date.UTC(year, month - 1, day, hour, minute, second);
  const zonedMs = Date.UTC(
    asZoned.year,
    asZoned.month - 1,
    asZoned.day,
    asZoned.hour,
    asZoned.minute,
    asZoned.second,
  );
  const offset = zonedMs - targetMs;
  return new Date(targetMs - offset);
}

function mondayOfWeek(parts: ZonedParts): { year: number; month: number; day: number } {
  const daysFromMonday = (parts.weekday + 6) % 7;
  const d = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
  d.setUTCDate(d.getUTCDate() - daysFromMonday);
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1, day: d.getUTCDate() };
}

export function getRegionTimeZone(region: ChampionshipRegion): string {
  return CHAMPIONSHIP_REGIONS[region].timeZone;
}

export function resolveEventStatus(
  now: Date,
  startsAt: Date,
  endsAt: Date,
  reviewEndsAt: Date,
  finalizedAt?: string | null,
): ChampionshipEventStatus {
  if (finalizedAt) return 'finalized';
  if (now < startsAt) return 'upcoming';
  if (now <= endsAt) return 'live';
  if (now <= reviewEndsAt) return 'reviewing';
  return 'finalized';
}

export function getWeekIndexForDate(region: ChampionshipRegion, date: Date): number {
  const tz = getRegionTimeZone(region);
  const seasonStart = new Date(PTCS_SEASON.startsAt);
  const seasonParts = parseParts(seasonStart, tz);
  const mon = mondayOfWeek(seasonParts);
  const seasonMonday = zonedToUtc(mon.year, mon.month, mon.day, 0, 0, 0, tz);

  const currentParts = parseParts(date, tz);
  const currentMon = mondayOfWeek(currentParts);
  const weekMonday = zonedToUtc(currentMon.year, currentMon.month, currentMon.day, 0, 0, 0, tz);

  const diffMs = weekMonday.getTime() - seasonMonday.getTime();
  return Math.max(1, Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000)) + 1);
}

export function buildWeeklyEvent(
  region: ChampionshipRegion,
  weekIndex: number,
  referenceMonday?: { year: number; month: number; day: number },
  finalizedAt?: string | null,
): ChampionshipEvent {
  const tz = getRegionTimeZone(region);
  const seasonStart = new Date(PTCS_SEASON.startsAt);
  const seasonParts = parseParts(seasonStart, tz);
  const baseMon = referenceMonday ?? mondayOfWeek(seasonParts);

  const monday = new Date(Date.UTC(baseMon.year, baseMon.month - 1, baseMon.day));
  monday.setUTCDate(monday.getUTCDate() + (weekIndex - 1) * 7);

  const startsAt = zonedToUtc(
    monday.getUTCFullYear(),
    monday.getUTCMonth() + 1,
    monday.getUTCDate(),
    0,
    0,
    0,
    tz,
  );
  const sunday = new Date(monday);
  sunday.setUTCDate(sunday.getUTCDate() + 6);
  const endsAt = zonedToUtc(
    sunday.getUTCFullYear(),
    sunday.getUTCMonth() + 1,
    sunday.getUTCDate(),
    23,
    59,
    59,
    tz,
  );
  const reviewEndsAt = new Date(endsAt.getTime() + PTCS_REVIEW_WINDOW_HOURS * 60 * 60 * 1000);
  const now = new Date();

  return {
    id: `${PTCS_SEASON.id}-${region}-w${weekIndex}`,
    region,
    weekIndex,
    weekLabel: `PTCS Week ${weekIndex}`,
    seasonId: PTCS_SEASON.id,
    seasonLabel: PTCS_SEASON.label,
    startsAt: startsAt.toISOString(),
    endsAt: endsAt.toISOString(),
    reviewEndsAt: reviewEndsAt.toISOString(),
    status: resolveEventStatus(now, startsAt, endsAt, reviewEndsAt, finalizedAt),
    finalizedAt: finalizedAt ?? null,
  };
}

export function getActiveEvent(region: ChampionshipRegion, now = new Date()): ChampionshipEvent {
  const weekIndex = getWeekIndexForDate(region, now);
  return buildWeeklyEvent(region, weekIndex);
}

export function formatCountdown(targetIso: string, now = new Date()): string {
  const target = new Date(targetIso).getTime();
  const diff = Math.max(0, target - now.getTime());
  const sec = Math.floor(diff / 1000);
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

export function countdownLabel(event: ChampionshipEvent, now = new Date()): string {
  if (event.status === 'upcoming') {
    return `Starts in ${formatCountdown(event.startsAt, now)}`;
  }
  if (event.status === 'live') {
    return `Ends in ${formatCountdown(event.endsAt, now)}`;
  }
  if (event.status === 'reviewing') {
    return `Review ends in ${formatCountdown(event.reviewEndsAt, now)}`;
  }
  return 'Finalized';
}

export function readStoredRegion(): ChampionshipRegion | null {
  if (typeof window === 'undefined') return null;
  try {
    const v = window.localStorage.getItem(CHAMPIONSHIP_REGION_STORAGE_KEY);
    if (v === 'na' || v === 'eu' || v === 'asia' || v === 'global') return v;
    return null;
  } catch {
    return null;
  }
}

export function storeRegion(region: ChampionshipRegion): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CHAMPIONSHIP_REGION_STORAGE_KEY, region);
  } catch {
    /* ignore */
  }
}
