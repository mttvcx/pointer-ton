import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePointerUser } from '@/lib/api/privyUser';
import { getRewardClaimSummary } from '@/lib/rewards/claimSummary';
import { SOL_CLAIM_EPS } from '@/lib/rewards/constants';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({
    scopes: z
      .array(z.enum(['referral_fees', 'pointer_points', 'cashback_sol']))
      .optional(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const r = await requirePointerUser(req);
  if ('error' in r) return r.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });
  }

  const summary = await getRewardClaimSummary(r.user.id);
  const scopes = parsed.data.scopes ?? (['referral_fees', 'pointer_points', 'cashback_sol'] as const);

  const hitReferral =
    scopes.includes('referral_fees') && summary.referralFeesPendingSol >= SOL_CLAIM_EPS;
  const hitPoints =
    scopes.includes('pointer_points') &&
    summary.pointerPointsClaimable > 0 &&
    Number.isFinite(summary.pointerPointsClaimable);
  const hitCashback =
    scopes.includes('cashback_sol') &&
    summary.cashbackPendingSol >= SOL_CLAIM_EPS;

  if (!hitReferral && !hitPoints && !hitCashback) {
    return NextResponse.json(
      {
        error: 'nothing_to_claim',
        amounts: summary,
      },
      { status: 400 },
    );
  }

  /** Bookkeeping payouts stay admin-driven (`/api/referrals/payout`) until automation lands. */
  const lines: string[] = [];
  if (hitReferral) {
    lines.push(
      'Referral SOL: Pending fees stay credited until the next SOL settlement batch; your ledger switches to Paid after transfer.',
    );
  }
  if (hitPoints) {
    lines.push('Pointer points: Redemption sinks roll out with Rewards — balances already accrue in Points.');
  }
  if (hitCashback) {
    lines.push('Cashback SOL: Routed fee rebates accrue here; settlement mirrors referral cadence.');
  }

  return NextResponse.json({
    ok: true,
    confirmedScopes: {
      referral_fees: hitReferral,
      pointer_points: hitPoints,
      cashback_sol: hitCashback,
    },
    amounts: summary,
    message: lines.join(' '),
  });
}
