import { LOW_SAMPLE_MIN_TRADES, LOW_SAMPLE_MIN_VOLUME_USD } from '@/lib/championship/config';
import type { ChampionshipScoreInput, ReviewStatus } from '@/lib/championship/types';

const EXTREME_TRADE_COUNT = 400;
const LOW_DIVERSITY_TRADE_THRESHOLD = 80;
const LOW_DIVERSITY_TOKEN_MAX = 3;
const WASH_VOLUME_USD = 25_000;
const WASH_PNL_MAX_USD = 25;
const WASH_TOKEN_MAX = 2;
const FARM_TRADE_COUNT = 120;
const FARM_AVG_SIZE_USD = 15;

export interface AbuseFlagResult {
  flags: string[];
  suggestedReviewStatus: ReviewStatus;
}

/** v1 heuristic flagging — review only, no auto-ban. */
export function detectSuspiciousFlags(input: ChampionshipScoreInput): AbuseFlagResult {
  const flags: string[] = [];

  if (
    input.closedTrades >= LOW_DIVERSITY_TRADE_THRESHOLD &&
    input.uniqueTokensTraded <= LOW_DIVERSITY_TOKEN_MAX
  ) {
    flags.push('low_token_diversity_high_trade_count');
  }

  if (input.eventVolumeUsd >= WASH_VOLUME_USD && Math.abs(input.realizedPnlUsd) <= WASH_PNL_MAX_USD) {
    if (input.uniqueTokensTraded <= WASH_TOKEN_MAX) {
      flags.push('wash_volume_suspected');
    }
  }

  if (input.closedTrades >= FARM_TRADE_COUNT && input.eventVolumeUsd / input.closedTrades < FARM_AVG_SIZE_USD) {
    flags.push('tiny_size_trade_farming');
  }

  if (input.closedTrades >= EXTREME_TRADE_COUNT) {
    flags.push('extreme_trade_frequency');
  }

  if (input.profitableClosedTrades > 0 && input.closedTrades > 0) {
    const winRate = input.profitableClosedTrades / input.closedTrades;
    if (input.closedTrades >= 50 && winRate > 0.98 && input.realizedPnlUsd < 100) {
      flags.push('suspicious_win_rate_low_pnl');
    }
  }

  // TODO Phase 2: circular/self-like trade graph detection
  // TODO Phase 2: wallet cluster / same IP-device linkage
  // TODO Phase 2: referral self-ref rings
  // TODO Phase 2: multiple wallets same user in solo bracket

  const isLowSample =
    input.eventVolumeUsd < LOW_SAMPLE_MIN_VOLUME_USD || input.closedTrades < LOW_SAMPLE_MIN_TRADES;

  let suggestedReviewStatus: ReviewStatus = input.reviewStatus;
  if (input.reviewStatus === 'disqualified' || input.reviewStatus === 'finalized') {
    return { flags, suggestedReviewStatus: input.reviewStatus };
  }

  if (flags.length >= 2) {
    suggestedReviewStatus = 'flagged';
  } else if (flags.length === 1) {
    suggestedReviewStatus = 'under_review';
  } else if (isLowSample) {
    suggestedReviewStatus = 'low_sample';
  } else {
    suggestedReviewStatus = 'eligible';
  }

  return { flags, suggestedReviewStatus };
}

export function mergeReviewStatus(
  current: ReviewStatus,
  suggested: ReviewStatus,
): ReviewStatus {
  const rank: Record<ReviewStatus, number> = {
    eligible: 0,
    low_sample: 1,
    under_review: 2,
    flagged: 3,
    disqualified: 4,
    finalized: 5,
  };
  return rank[suggested] > rank[current] ? suggested : current;
}
