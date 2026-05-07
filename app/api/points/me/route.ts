import { NextResponse, type NextRequest } from 'next/server';
import { requirePointerUser } from '@/lib/api/privyUser';
import { createAdminSupabase } from '@/lib/supabase/server';
import { getPointsBreakdownForUser, getTotalPointsForUser } from '@/lib/points/queries';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const r = await requirePointerUser(req);
  if ('error' in r) return r.error;

  try {
    const supabase = createAdminSupabase();
    const [totalPoints, breakdown, lbRes] = await Promise.all([
      getTotalPointsForUser(r.user.id),
      getPointsBreakdownForUser(r.user.id),
      supabase.from('points_leaderboard').select('*').eq('user_id', r.user.id).maybeSingle(),
    ]);

    if (lbRes.error) throw new Error(lbRes.error.message);

    const lb = lbRes.data;

    return NextResponse.json({
      totalPoints,
      breakdown: breakdown.sort((a, b) => b.total - a.total),
      rank: lb?.rank ?? null,
      leaderboard: lb
        ? {
            totalPoints: Number(lb.total_points),
            activeDays: Number(lb.active_days),
            rank: Number(lb.rank),
          }
        : null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
