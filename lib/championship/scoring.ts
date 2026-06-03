import {
  placementPointsForRank,
  SOLO_PLACEMENT_POINTS,
  SQUAD_PLACEMENT_POINTS,
  SQUAD_SCORE_TOP_MEMBERS,
  LOW_SAMPLE_MIN_TRADES,
  LOW_SAMPLE_MIN_VOLUME_USD,
} from '@/lib/championship/config';
import { detectSuspiciousFlags, mergeReviewStatus } from '@/lib/championship/flags';
import type {
  ChampionshipLeaderboardEntry,
  ChampionshipParticipantStats,
  ChampionshipScoreBreakdown,
  ChampionshipScoreInput,
  ReviewStatus,
  SquadLeaderboardEntry,
} from '@/lib/championship/types';

export function roiMultiplier(roiPct: number): number {
  if (roiPct < 0) return 0.25;
  if (roiPct < 10) return 1;
  if (roiPct < 25) return 1.15;
  if (roiPct < 50) return 1.3;
  if (roiPct < 100) return 1.5;
  return 1.75;
}

export function pnlPoints(realizedPnlUsd: number): number {
  if (realizedPnlUsd <= 0) return 0;
  return Math.floor(realizedPnlUsd / 10);
}

export function volumePoints(eventVolumeUsd: number): number {
  if (eventVolumeUsd <= 0) return 0;
  return Math.floor(eventVolumeUsd / 1000);
}

export function profitEventPoints(closedTradeRoisPct: number[]): number {
  let total = 0;
  for (const roi of closedTradeRoisPct) {
    if (roi <= 0) continue;
    total += 2;
    if (roi > 50) total += 10;
    if (roi > 100) total += 20;
    if (roi > 500) total += 50;
    if (roi > 1000) total += 100;
  }
  return total;
}

export function drawdownMultiplier(maxDrawdownPct: number): number {
  if (maxDrawdownPct > 75) return 0.5;
  if (maxDrawdownPct > 50) return 0.75;
  return 1;
}

export function isLowSample(input: ChampionshipScoreInput): boolean {
  return (
    input.eventVolumeUsd < LOW_SAMPLE_MIN_VOLUME_USD || input.closedTrades < LOW_SAMPLE_MIN_TRADES
  );
}

export function qualifiesForPrizes(
  reviewStatus: ReviewStatus,
  realizedPnlUsd: number,
): boolean {
  if (realizedPnlUsd < 0) return false;
  return (
    reviewStatus === 'eligible' ||
    reviewStatus === 'low_sample' ||
    reviewStatus === 'finalized'
  );
}

/** Core score without placement — pure function. */
export function scoreParticipant(
  input: ChampionshipScoreInput,
  placementPoints = 0,
): ChampionshipScoreBreakdown {
  const abuse = detectSuspiciousFlags(input);
  const reviewStatus = mergeReviewStatus(input.reviewStatus, abuse.suggestedReviewStatus);
  const allFlags = [...new Set([...input.suspiciousFlags, ...abuse.flags])];

  const pnlPts = pnlPoints(input.realizedPnlUsd);
  const profitPts = profitEventPoints(input.closedTradeRoisPct);
  const roiMult = roiMultiplier(input.roiPct);
  const volPts = volumePoints(input.eventVolumeUsd);
  const pre = (pnlPts + profitPts) * roiMult + volPts;
  const ddMult = drawdownMultiplier(input.maxDrawdownPct);
  let final = (pre + placementPoints) * ddMult;

  if (reviewStatus === 'disqualified') {
    final = 0;
  }

  const lowSample = isLowSample(input);

  return {
    pnlPoints: pnlPts,
    profitEventPoints: profitPts,
    roiMultiplier: roiMult,
    volumePoints: volPts,
    placementPoints,
    preScore: pre,
    drawdownMultiplier: ddMult,
    finalScore: Math.round(final * 100) / 100,
    reviewStatus,
    qualifiesForPrizes: qualifiesForPrizes(reviewStatus, input.realizedPnlUsd) && allFlags.length === 0,
    isLowSample: lowSample,
  };
}

export function buildSoloLeaderboard(
  participants: ChampionshipParticipantStats[],
): ChampionshipLeaderboardEntry[] {
  const prelim = participants.map((p) => ({
    participant: {
      ...p,
      suspiciousFlags: [
        ...new Set([...p.suspiciousFlags, ...detectSuspiciousFlags(p).flags]),
      ],
    },
    score: scoreParticipant(p, 0),
  }));

  prelim.sort((a, b) => b.score.preScore - a.score.preScore);

  const withPlacement = prelim.map((row, i) => {
    const rank = i + 1;
    const placement = placementPointsForRank(rank, SOLO_PLACEMENT_POINTS);
    const score = scoreParticipant(row.participant, placement);
    return { participant: row.participant, score, rank: 0, rankChange: undefined as number | undefined };
  });

  withPlacement.sort((a, b) => b.score.finalScore - a.score.finalScore);

  return withPlacement.map((row, i) => ({
    ...row,
    rank: i + 1,
  }));
}

export function squadScoreFromMembers(memberScores: number[]): number {
  const sorted = [...memberScores].sort((a, b) => b - a);
  return sorted.slice(0, SQUAD_SCORE_TOP_MEMBERS).reduce((s, n) => s + n, 0);
}

export function buildSquadLeaderboard(
  squads: {
    squadId: string;
    squadName: string;
    slug: string;
    members: ChampionshipParticipantStats[];
    rankChange?: number;
  }[],
): SquadLeaderboardEntry[] {
  const rows = squads.map((s) => {
    const memberScored = s.members
      .map((m) => ({
        participant: m,
        score: scoreParticipant(m, 0).finalScore,
      }))
      .sort((a, b) => b.score - a.score);
    const topScores = memberScored.map((e) => e.score);
    const combinedScore = squadScoreFromMembers(topScores);
    const topMembers = memberScored.slice(0, SQUAD_SCORE_TOP_MEMBERS).map((e) => ({
      displayName: e.participant.displayName,
      score: e.score,
      userId: e.participant.userId,
    }));

    const combinedPnl = s.members.reduce((sum, m) => sum + m.realizedPnlUsd, 0);
    const combinedVol = s.members.reduce((sum, m) => sum + m.eventVolumeUsd, 0);

    const worstReview = s.members.reduce<ReviewStatus>((acc, m) => {
      const r = detectSuspiciousFlags(m).suggestedReviewStatus;
      return mergeReviewStatus(acc, r);
    }, 'eligible');

    return {
      squadId: s.squadId,
      squadName: s.squadName,
      slug: s.slug,
      memberCount: s.members.length,
      membersCounted: Math.min(s.members.length, SQUAD_SCORE_TOP_MEMBERS),
      combinedPnlUsd: combinedPnl,
      combinedVolumeUsd: combinedVol,
      combinedScore,
      topMembers,
      reviewStatus: worstReview,
      rankChange: s.rankChange,
      rank: 0,
    };
  });

  rows.sort((a, b) => b.combinedScore - a.combinedScore);

  return rows.map((row, i) => {
    const rank = i + 1;
    const placement = placementPointsForRank(rank, SQUAD_PLACEMENT_POINTS);
    return {
      ...row,
      rank,
      combinedScore: row.combinedScore + placement,
    };
  });
}
