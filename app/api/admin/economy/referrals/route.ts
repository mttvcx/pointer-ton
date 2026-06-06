import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAdmin } from '@/lib/api/adminAuth';
import {
  listReferralEarningsForUser,
  sumReferralEarningsLamports,
  listUnpaidReferralEarningIds,
} from '@/lib/referrals/earnings';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Query = z.object({ referrerId: z.string().uuid() });

export async function GET(req: NextRequest) {
  const auth = await requireAdmin(req, 'referrals.read');
  if (!auth.ok) return auth.response;

  const url = new URL(req.url);
  const parsed = Query.safeParse({ referrerId: url.searchParams.get('referrerId') ?? '' });
  if (!parsed.success) return NextResponse.json({ error: 'invalid_query' }, { status: 400 });

  try {
    const [earnings, totals, unpaidIds] = await Promise.all([
      listReferralEarningsForUser(parsed.data.referrerId, { limit: 100 }),
      sumReferralEarningsLamports(parsed.data.referrerId),
      listUnpaidReferralEarningIds(parsed.data.referrerId),
    ]);
    return NextResponse.json({ earnings, totals, unpaidIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'list_failed';
    return NextResponse.json({ error: 'list_failed', message }, { status: 500 });
  }
}
