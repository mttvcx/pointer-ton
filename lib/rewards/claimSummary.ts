import 'server-only';

import { getTotalPointsForUser } from '@/lib/points/queries';
import { sumReferralEarningsLamports } from '@/lib/referrals/earnings';
import { getCashbackBalanceSol } from '@/lib/db/adminEconomy';
import { lamportsToSol } from '@/lib/utils/formatters';

export type RewardClaimSummary = {
  referralFeesPendingSol: number;
  pointerPointsClaimable: number;
  cashbackPendingSol: number;
  lifetimePointerPoints: number;
};

/** Points redemption bucket — increments when Rewards ships a redemption sink. */
function readPositiveIntEnv(name: string): number {
  const raw = process.env[name]?.trim();
  if (raw === undefined || raw === '') return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
}

function readDemoCashbackSol(): number {
  const raw = process.env.POINTER_CASHBACK_CLAIMABLE_SOL_DEMO?.trim();
  if (raw === undefined || raw === '') return 0;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export async function getRewardClaimSummary(userId: string): Promise<RewardClaimSummary> {
  const [sums, lifetimePointerPoints, cashbackLedgerSol] = await Promise.all([
    sumReferralEarningsLamports(userId),
    getTotalPointsForUser(userId),
    getCashbackBalanceSol(userId).catch(() => 0),
  ]);

  const referralFeesPendingSol = lamportsToSol(BigInt(Math.round(sums.pending)));

  /** Internal alpha: opt-in surfaced claimable row without DB migration yet. */
  const pointerPointsClaimable = readPositiveIntEnv('POINTER_POINTS_CLAIMABLE_DEMO');

  // Real accrued cashback (per-trade rebate + admin grants), plus any demo
  // override env for internal testing (defaults to 0 → pure real balance).
  const cashbackPendingSol = cashbackLedgerSol + readDemoCashbackSol();

  return {
    referralFeesPendingSol,
    pointerPointsClaimable,
    cashbackPendingSol,
    lifetimePointerPoints,
  };
}
