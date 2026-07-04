import { type NextRequest, NextResponse } from 'next/server';
import { requireAnyAdmin } from '@/lib/api/adminAuth';
import { getSpendSummary } from '@/lib/ai/quota';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** AI spend dashboard data — org hourly/daily/monthly totals vs ceilings plus
 *  top users / endpoints / providers for the day. Any admin may view. */
export async function GET(req: NextRequest) {
  const auth = await requireAnyAdmin(req);
  if (!auth.ok) return auth.response;
  const summary = await getSpendSummary();
  return NextResponse.json(summary);
}
