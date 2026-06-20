import type { PackOpenResult, PackReward } from '@/types/pack';
import { LAMPORTS_PER_SOL } from '@/lib/utils/formatters';

/** A single on-chain buy the treasury performs to deliver a won token reward. */
export type RewardBuyIntent = {
  rewardId: string;
  mint: string;
  symbol: string | null;
  valueSol: number;
  lamportsToSpend: number;
};

export type RewardFulfillmentPlan = {
  intents: RewardBuyIntent[];
  /** Total SOL the treasury spends fulfilling token rewards (after the cap). */
  totalSpendSol: number;
  totalSpendLamports: number;
  /** Rewards not fulfilled on-chain (multipliers, badges, capped, malformed). */
  skipped: Array<{ rewardId: string; kind: string; reason: string }>;
};

function isTokenReward(r: PackReward): boolean {
  return r.kind === 'token_reward' || r.kind === 'legendary_reward';
}

/**
 * Map a pack open result to the set of on-chain token buys the treasury must
 * execute to deliver the winnings. Pure + deterministic so it can be unit
 * tested and re-derived idempotently.
 *
 * Only token rewards are delivered on-chain. Multiplier / badge rewards are
 * non-custodial perks credited elsewhere (out of scope here) and are reported
 * in `skipped`. A defensive cumulative cap of `maxPayoutSol` prevents a
 * malformed config from draining the treasury in a single open.
 */
export function buildRewardFulfillmentPlan(
  result: Pick<PackOpenResult, 'rewards'>,
  opts: { maxPayoutSol: number },
): RewardFulfillmentPlan {
  const intents: RewardBuyIntent[] = [];
  const skipped: RewardFulfillmentPlan['skipped'] = [];
  const cap = Number.isFinite(opts.maxPayoutSol) && opts.maxPayoutSol > 0 ? opts.maxPayoutSol : 0;

  let spent = 0;
  for (const r of result.rewards) {
    if (!isTokenReward(r)) {
      skipped.push({ rewardId: r.id, kind: r.kind, reason: 'non_token_reward' });
      continue;
    }
    const mint = r.tokenMint ?? null;
    const valueSol = r.valueSol ?? 0;
    if (!mint || !(valueSol > 0)) {
      skipped.push({ rewardId: r.id, kind: r.kind, reason: 'missing_mint_or_value' });
      continue;
    }
    if (spent + valueSol > cap + 1e-9) {
      skipped.push({ rewardId: r.id, kind: r.kind, reason: 'exceeds_max_payout_cap' });
      continue;
    }
    spent += valueSol;
    intents.push({
      rewardId: r.id,
      mint,
      symbol: r.tokenSymbol ?? null,
      valueSol,
      lamportsToSpend: Math.round(valueSol * LAMPORTS_PER_SOL),
    });
  }

  return {
    intents,
    totalSpendSol: spent,
    totalSpendLamports: intents.reduce((s, i) => s + i.lamportsToSpend, 0),
    skipped,
  };
}
