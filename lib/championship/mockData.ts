import { buildSoloLeaderboard, buildSquadLeaderboard } from '@/lib/championship/scoring';
import type {
  ChampionshipEvent,
  ChampionshipLeaderboardEntry,
  ChampionshipParticipantStats,
  ChampionshipRegion,
  SquadLeaderboardEntry,
  WorldCupQualifierEntry,
} from '@/lib/championship/types';
import { buildWorldCupStandings, soloWcPointsForRank, squadWcPointsForRank, type FinalizedWeeklyCupResult } from '@/lib/championship/worldCup';
import { championshipDemoDataEnabled } from '@/lib/championship/mode';

function rois(...values: number[]): number[] {
  return values;
}

const DEMO_PARTICIPANTS: ChampionshipParticipantStats[] = [
  {
    userId: 'demo-u1',
    displayName: 'NovaPulse',
    handle: 'novapulse',
    realizedPnlUsd: 4280,
    eventVolumeUsd: 92000,
    closedTrades: 38,
    profitableClosedTrades: 24,
    uniqueTokensTraded: 14,
    biggestWinRoiPct: 186,
    roiPct: 42.5,
    maxDrawdownPct: 22,
    suspiciousFlags: [],
    reviewStatus: 'eligible',
    closedTradeRoisPct: rois(12, 45, 186, 8, -5, 22, 90, 15),
  },
  {
    userId: 'demo-u2',
    displayName: 'ChartGhost',
    handle: 'chartghost',
    realizedPnlUsd: 3150,
    eventVolumeUsd: 68000,
    closedTrades: 29,
    profitableClosedTrades: 19,
    uniqueTokensTraded: 11,
    biggestWinRoiPct: 240,
    roiPct: 38.2,
    maxDrawdownPct: 18,
    suspiciousFlags: [],
    reviewStatus: 'eligible',
    closedTradeRoisPct: rois(55, 240, 18, 30, 12),
  },
  {
    userId: 'demo-u3',
    displayName: 'SolSniper',
    realizedPnlUsd: 2890,
    eventVolumeUsd: 54000,
    closedTrades: 22,
    profitableClosedTrades: 16,
    uniqueTokensTraded: 9,
    biggestWinRoiPct: 320,
    roiPct: 52.1,
    maxDrawdownPct: 31,
    suspiciousFlags: [],
    reviewStatus: 'eligible',
    closedTradeRoisPct: rois(320, 44, 28, 60),
  },
  {
    userId: 'demo-u4',
    displayName: 'MemeMachina',
    realizedPnlUsd: 1980,
    eventVolumeUsd: 41000,
    closedTrades: 18,
    profitableClosedTrades: 11,
    uniqueTokensTraded: 8,
    biggestWinRoiPct: 95,
    roiPct: 24.6,
    maxDrawdownPct: 28,
    suspiciousFlags: [],
    reviewStatus: 'eligible',
    closedTradeRoisPct: rois(95, 22, 18, -8),
  },
  {
    userId: 'demo-u5',
    displayName: 'RiskRaven',
    realizedPnlUsd: 1540,
    eventVolumeUsd: 36000,
    closedTrades: 15,
    profitableClosedTrades: 9,
    uniqueTokensTraded: 7,
    biggestWinRoiPct: 72,
    roiPct: 19.4,
    maxDrawdownPct: 35,
    suspiciousFlags: [],
    reviewStatus: 'low_sample',
    closedTradeRoisPct: rois(72, 15, 8, -12),
  },
  {
    userId: 'demo-u6',
    displayName: 'WashWatch',
    handle: 'washwatch',
    realizedPnlUsd: 12,
    eventVolumeUsd: 48000,
    closedTrades: 210,
    profitableClosedTrades: 98,
    uniqueTokensTraded: 2,
    biggestWinRoiPct: 4,
    roiPct: 0.8,
    maxDrawdownPct: 5,
    suspiciousFlags: ['wash_volume_suspected'],
    reviewStatus: 'under_review',
    closedTradeRoisPct: rois(2, 1, 3, 4, 2, 1),
  },
  {
    userId: 'demo-u7',
    displayName: 'TinyFarmer',
    realizedPnlUsd: 45,
    eventVolumeUsd: 8200,
    closedTrades: 145,
    profitableClosedTrades: 70,
    uniqueTokensTraded: 3,
    biggestWinRoiPct: 8,
    roiPct: 2.1,
    maxDrawdownPct: 12,
    suspiciousFlags: ['tiny_size_trade_farming', 'low_token_diversity_high_trade_count'],
    reviewStatus: 'flagged',
    closedTradeRoisPct: rois(3, 4, 8, 2, 1),
  },
  {
    userId: 'demo-u8',
    displayName: 'DrawdownDan',
    realizedPnlUsd: 890,
    eventVolumeUsd: 28000,
    closedTrades: 20,
    profitableClosedTrades: 11,
    uniqueTokensTraded: 6,
    biggestWinRoiPct: 110,
    roiPct: 14.2,
    maxDrawdownPct: 58,
    suspiciousFlags: [],
    reviewStatus: 'eligible',
    closedTradeRoisPct: rois(110, 25, -20, 15),
  },
  {
    userId: 'demo-u9',
    displayName: 'NewWallet',
    realizedPnlUsd: 120,
    eventVolumeUsd: 320,
    closedTrades: 2,
    profitableClosedTrades: 1,
    uniqueTokensTraded: 2,
    biggestWinRoiPct: 35,
    roiPct: 8.5,
    maxDrawdownPct: 10,
    suspiciousFlags: [],
    reviewStatus: 'low_sample',
    closedTradeRoisPct: rois(35, -5),
  },
  {
    userId: 'demo-u10',
    displayName: 'RedDay',
    realizedPnlUsd: -420,
    eventVolumeUsd: 12000,
    closedTrades: 12,
    profitableClosedTrades: 4,
    uniqueTokensTraded: 5,
    biggestWinRoiPct: 40,
    roiPct: -6.2,
    maxDrawdownPct: 42,
    suspiciousFlags: [],
    reviewStatus: 'eligible',
    closedTradeRoisPct: rois(40, -15, -22, 8),
  },
  {
    userId: 'demo-u11',
    displayName: 'PointerYou',
    handle: 'you',
    realizedPnlUsd: 760,
    eventVolumeUsd: 18500,
    closedTrades: 11,
    profitableClosedTrades: 7,
    uniqueTokensTraded: 6,
    biggestWinRoiPct: 88,
    roiPct: 16.8,
    maxDrawdownPct: 19,
    suspiciousFlags: [],
    reviewStatus: 'eligible',
    closedTradeRoisPct: rois(88, 22, 12, -4, 30),
  },
  {
    userId: 'demo-u12',
    displayName: 'AlphaArc',
    realizedPnlUsd: 640,
    eventVolumeUsd: 22000,
    closedTrades: 14,
    profitableClosedTrades: 8,
    uniqueTokensTraded: 5,
    biggestWinRoiPct: 64,
    roiPct: 12.4,
    maxDrawdownPct: 25,
    suspiciousFlags: [],
    reviewStatus: 'eligible',
    closedTradeRoisPct: rois(64, 18, -6),
  },
];

const DEMO_SQUADS = [
  {
    squadId: 'demo-s1',
    squadName: 'North Star',
    slug: 'north-star',
    members: ['demo-u1', 'demo-u4', 'demo-u11', 'demo-u12', 'demo-u9'],
    rankChange: 1,
  },
  {
    squadId: 'demo-s2',
    squadName: 'Liquidity Legion',
    slug: 'liquidity-legion',
    members: ['demo-u2', 'demo-u3', 'demo-u8'],
    rankChange: -1,
  },
  {
    squadId: 'demo-s3',
    squadName: 'Chart Cartel',
    slug: 'chart-cartel',
    members: ['demo-u5', 'demo-u10', 'demo-u12', 'demo-u11'],
    rankChange: 0,
  },
];

export interface ChampionshipDemoBundle {
  solo: ChampionshipLeaderboardEntry[];
  squads: SquadLeaderboardEntry[];
  worldCup: WorldCupQualifierEntry[];
  lastWeekQualifiers: {
    solo: { rank: number; displayName: string; points: number }[];
    squads: { rank: number; displayName: string; points: number }[];
  };
  viewerUserId: string;
}

function participantById(id: string): ChampionshipParticipantStats | undefined {
  return DEMO_PARTICIPANTS.find((p) => p.userId === id);
}

export function getDemoChampionshipBundle(_event: ChampionshipEvent): ChampionshipDemoBundle | null {
  if (!championshipDemoDataEnabled()) return null;

  const solo = buildSoloLeaderboard(DEMO_PARTICIPANTS);

  const squads = buildSquadLeaderboard(
    DEMO_SQUADS.map((s) => ({
      squadId: s.squadId,
      squadName: s.squadName,
      slug: s.slug,
      rankChange: s.rankChange,
      members: s.members
        .map((id) => participantById(id))
        .filter((p): p is ChampionshipParticipantStats => Boolean(p)),
    })),
  );

  const priorWeek: FinalizedWeeklyCupResult = {
    weekIndex: Math.max(1, _event.weekIndex - 1),
    solo: solo.slice(0, 10).map((e) => ({ rank: e.rank, participant: e.participant })),
    squads: squads.slice(0, 3).map((e) => ({
      rank: e.rank,
      squadId: e.squadId,
      squadName: e.squadName,
    })),
  };

  const worldCup = buildWorldCupStandings([priorWeek, priorWeek]);

  return {
    solo,
    squads,
    worldCup,
    lastWeekQualifiers: {
      solo: priorWeek.solo.map((e) => ({
        rank: e.rank,
        displayName: e.participant.displayName,
        points: soloWcPointsForRank(e.rank),
      })),
      squads: priorWeek.squads.map((e) => ({
        rank: e.rank,
        displayName: e.squadName,
        points: squadWcPointsForRank(e.rank),
      })),
    },
    viewerUserId: 'demo-u11',
  };
}

/** Server-safe check for demo fixtures. */
export function isChampionshipDemoMode(): boolean {
  return championshipDemoDataEnabled();
}

export function emptyChampionshipBundle(viewerUserId?: string | null): ChampionshipDemoBundle {
  return {
    solo: [],
    squads: [],
    worldCup: [],
    lastWeekQualifiers: { solo: [], squads: [] },
    viewerUserId: viewerUserId ?? '',
  };
}

export type { ChampionshipRegion };
