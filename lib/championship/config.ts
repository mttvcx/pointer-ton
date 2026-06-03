import type { ChampionshipRegion, ChampionshipSeason } from '@/lib/championship/types';

export const CHAMPIONSHIP_REGION_STORAGE_KEY = 'pointer-ptcs-region';

export const CHAMPIONSHIP_REGIONS: Record<
  ChampionshipRegion,
  { label: string; shortLabel: string; timeZone: string }
> = {
  na: { label: 'North America', shortLabel: 'NA', timeZone: 'America/New_York' },
  eu: { label: 'Europe', shortLabel: 'EU', timeZone: 'Europe/Paris' },
  asia: { label: 'Asia', shortLabel: 'Asia', timeZone: 'Asia/Singapore' },
  global: { label: 'Global', shortLabel: 'Global', timeZone: 'UTC' },
};

/** First PTCS season — weekly cups Mon→Sun in region TZ. */
export const PTCS_SEASON: ChampionshipSeason = {
  id: 'ptcs-2026-s1',
  label: 'PTCS Season 1',
  startsAt: '2026-03-02T00:00:00.000Z',
  endsAt: '2026-06-28T23:59:59.999Z',
};

/** Hours after cup end before auto-review window closes (admin finalization TODO). */
export const PTCS_REVIEW_WINDOW_HOURS = 48;

export const LOW_SAMPLE_MIN_VOLUME_USD = 500;
export const LOW_SAMPLE_MIN_TRADES = 3;

export const SOLO_PLACEMENT_POINTS: { maxRank: number; points: number }[] = [
  { maxRank: 1, points: 100 },
  { maxRank: 2, points: 75 },
  { maxRank: 3, points: 60 },
  { maxRank: 10, points: 40 },
  { maxRank: 25, points: 25 },
  { maxRank: 50, points: 10 },
];

export const SQUAD_PLACEMENT_POINTS: { maxRank: number; points: number }[] = [
  { maxRank: 1, points: 100 },
  { maxRank: 2, points: 75 },
  { maxRank: 3, points: 60 },
  { maxRank: 10, points: 40 },
  { maxRank: 25, points: 25 },
];

export const SOLO_WC_QUALIFIER_POINTS: { maxRank: number; points: number }[] = [
  { maxRank: 1, points: 100 },
  { maxRank: 2, points: 75 },
  { maxRank: 3, points: 60 },
  { maxRank: 10, points: 40 },
];

export const SQUAD_WC_QUALIFIER_POINTS: { maxRank: number; points: number }[] = [
  { maxRank: 1, points: 100 },
  { maxRank: 2, points: 75 },
  { maxRank: 3, points: 60 },
];

export const SQUAD_SCORE_TOP_MEMBERS = 4;

export function placementPointsForRank(
  rank: number,
  table: { maxRank: number; points: number }[],
): number {
  if (rank < 1) return 0;
  for (const row of table) {
    if (rank <= row.maxRank) return row.points;
  }
  return 0;
}
