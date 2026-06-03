import {
  placementPointsForRank,
  SOLO_WC_QUALIFIER_POINTS,
  SQUAD_WC_QUALIFIER_POINTS,
} from '@/lib/championship/config';
import type { ChampionshipLeaderboardEntry, SquadLeaderboardEntry, WorldCupQualifierEntry } from '@/lib/championship/types';

export function soloWcPointsForRank(rank: number): number {
  return placementPointsForRank(rank, SOLO_WC_QUALIFIER_POINTS);
}

export function squadWcPointsForRank(rank: number): number {
  return placementPointsForRank(rank, SQUAD_WC_QUALIFIER_POINTS);
}

export interface FinalizedWeeklyCupResult {
  weekIndex: number;
  solo: Pick<ChampionshipLeaderboardEntry, 'rank' | 'participant'>[];
  squads: Pick<SquadLeaderboardEntry, 'rank' | 'squadId' | 'squadName'>[];
}

/** Accumulate World Cup qualifier points from finalized weekly cups. */
export function buildWorldCupStandings(
  finalizedWeeks: FinalizedWeeklyCupResult[],
): WorldCupQualifierEntry[] {
  const map = new Map<
    string,
    {
      entityId: string;
      displayName: string;
      kind: 'solo' | 'squad';
      qualifierPoints: number;
      weeklyPodiums: number;
      lastWeekFinish: number | null;
    }
  >();

  const sortedWeeks = [...finalizedWeeks].sort((a, b) => a.weekIndex - b.weekIndex);

  for (const week of sortedWeeks) {
    for (const row of week.solo) {
      if (row.rank > 10) continue;
      const pts = soloWcPointsForRank(row.rank);
      const key = `solo:${row.participant.userId}`;
      const prev = map.get(key);
      map.set(key, {
        entityId: row.participant.userId,
        displayName: row.participant.displayName,
        kind: 'solo',
        qualifierPoints: (prev?.qualifierPoints ?? 0) + pts,
        weeklyPodiums: (prev?.weeklyPodiums ?? 0) + (row.rank <= 3 ? 1 : 0),
        lastWeekFinish: row.rank,
      });
    }

    for (const row of week.squads) {
      if (row.rank > 3) continue;
      const pts = squadWcPointsForRank(row.rank);
      const key = `squad:${row.squadId}`;
      const prev = map.get(key);
      map.set(key, {
        entityId: row.squadId,
        displayName: row.squadName,
        kind: 'squad',
        qualifierPoints: (prev?.qualifierPoints ?? 0) + pts,
        weeklyPodiums: (prev?.weeklyPodiums ?? 0) + (row.rank <= 3 ? 1 : 0),
        lastWeekFinish: row.rank,
      });
    }
  }

  return [...map.values()]
    .sort((a, b) => b.qualifierPoints - a.qualifierPoints)
    .map((row, i) => ({ rank: i + 1, ...row }));
}
