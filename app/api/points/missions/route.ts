import { NextResponse, type NextRequest } from 'next/server';
import { requirePointerUser } from '@/lib/api/privyUser';
import { createAdminSupabase } from '@/lib/supabase/server';
import { DAILY_MISSIONS, type MissionProgress } from '@/lib/points/missions';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Today's (UTC) progress on the daily missions, derived from points_events. */
export async function GET(req: NextRequest) {
  const r = await requirePointerUser(req);
  if ('error' in r) return r.error;

  try {
    const supabase = createAdminSupabase();
    const start = new Date();
    start.setUTCHours(0, 0, 0, 0);
    const { data, error } = await supabase
      .from('points_events')
      .select('event_type')
      .eq('user_id', r.user.id)
      .gte('created_at', start.toISOString());
    if (error) throw new Error(error.message);

    const counts = new Map<string, number>();
    for (const row of data ?? []) {
      counts.set(row.event_type, (counts.get(row.event_type) ?? 0) + 1);
    }

    const missions: MissionProgress[] = DAILY_MISSIONS.map((m) => {
      const progress = Math.min(m.target, counts.get(m.eventType) ?? 0);
      return {
        id: m.id,
        label: m.label,
        hint: m.hint,
        target: m.target,
        progress,
        done: progress >= m.target,
        reward: m.reward,
      };
    });

    return NextResponse.json({ missions });
  } catch {
    // Never break the dashboard — just show nothing.
    return NextResponse.json({ missions: [] });
  }
}
