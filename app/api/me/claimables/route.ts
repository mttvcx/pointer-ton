import { NextResponse, type NextRequest } from 'next/server';
import { requirePointerUser } from '@/lib/api/privyUser';
import { getRewardClaimSummary } from '@/lib/rewards/claimSummary';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_req: NextRequest) {
  const r = await requirePointerUser(_req);
  if ('error' in r) return r.error;
  try {
    const summary = await getRewardClaimSummary(r.user.id);
    return NextResponse.json({
      ...summary,
      notes:
        'Referral SOL uses your pending referrer fees ledger (Paid once ops settle). Points and cashback portals unlock with the Rewards roadmap.',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
