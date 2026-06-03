/** Pointer Trading Championship Series — shared types. */

export type ChampionshipRegion = 'na' | 'eu' | 'asia' | 'global';

export type ChampionshipEventStatus = 'upcoming' | 'live' | 'reviewing' | 'finalized';

export type ReviewStatus =
  | 'eligible'
  | 'low_sample'
  | 'under_review'
  | 'flagged'
  | 'disqualified'
  | 'finalized';

export type ChampionshipTab = 'overview' | 'solo' | 'squads' | 'worldcup' | 'rules';

export interface ChampionshipEvent {
  id: string;
  region: ChampionshipRegion;
  weekIndex: number;
  weekLabel: string;
  seasonId: string;
  seasonLabel: string;
  startsAt: string;
  endsAt: string;
  reviewEndsAt: string;
  status: ChampionshipEventStatus;
  finalizedAt?: string | null;
}

export interface ChampionshipParticipantStats {
  userId: string;
  displayName: string;
  handle?: string;
  walletAddress?: string;
  avatarUrl?: string | null;
  realizedPnlUsd: number;
  eventVolumeUsd: number;
  closedTrades: number;
  profitableClosedTrades: number;
  uniqueTokensTraded: number;
  biggestWinRoiPct: number;
  roiPct: number;
  maxDrawdownPct: number;
  suspiciousFlags: string[];
  reviewStatus: ReviewStatus;
  /** Closed-trade ROI % values — used for profit-event scoring. */
  closedTradeRoisPct: number[];
}

export interface ChampionshipScoreBreakdown {
  pnlPoints: number;
  profitEventPoints: number;
  roiMultiplier: number;
  volumePoints: number;
  placementPoints: number;
  preScore: number;
  drawdownMultiplier: number;
  finalScore: number;
  reviewStatus: ReviewStatus;
  qualifiesForPrizes: boolean;
  isLowSample: boolean;
}

export interface ChampionshipLeaderboardEntry {
  rank: number;
  participant: ChampionshipParticipantStats;
  score: ChampionshipScoreBreakdown;
  rankChange?: number;
}

export interface SquadLeaderboardEntry {
  rank: number;
  squadId: string;
  squadName: string;
  slug: string;
  memberCount: number;
  membersCounted: number;
  combinedPnlUsd: number;
  combinedVolumeUsd: number;
  combinedScore: number;
  topMembers: { displayName: string; score: number; userId: string }[];
  reviewStatus: ReviewStatus;
  rankChange?: number;
}

export interface WorldCupQualifierEntry {
  rank: number;
  entityId: string;
  displayName: string;
  kind: 'solo' | 'squad';
  qualifierPoints: number;
  weeklyPodiums: number;
  lastWeekFinish?: number | null;
}

export interface ChampionshipSeason {
  id: string;
  label: string;
  startsAt: string;
  endsAt: string;
}

/** Raw inputs for scoring — maps from trade aggregation later. */
export type ChampionshipScoreInput = Pick<
  ChampionshipParticipantStats,
  | 'realizedPnlUsd'
  | 'eventVolumeUsd'
  | 'closedTrades'
  | 'profitableClosedTrades'
  | 'uniqueTokensTraded'
  | 'biggestWinRoiPct'
  | 'roiPct'
  | 'maxDrawdownPct'
  | 'suspiciousFlags'
  | 'reviewStatus'
  | 'closedTradeRoisPct'
>;
