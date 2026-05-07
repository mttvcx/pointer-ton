import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';

function num(v: unknown): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

/** Sum `final_points` for event type since UTC midnight. */
export async function sumFinalPointsUtcToday(
  userId: string,
  eventType: string,
): Promise<number> {
  const supabase = createAdminSupabase();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('points_events')
    .select('final_points')
    .eq('user_id', userId)
    .eq('event_type', eventType)
    .gte('created_at', start.toISOString());
  if (error) throw new Error(`sumFinalPointsUtcToday: ${error.message}`);
  let sum = 0;
  for (const r of data ?? []) sum += num(r.final_points);
  return sum;
}

/** Count tracker_setup awards for cap. */
export async function countTrackerSetupPointsEvents(userId: string): Promise<number> {
  const supabase = createAdminSupabase();
  const { count, error } = await supabase
    .from('points_events')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('event_type', 'tracker_setup');
  if (error) throw new Error(`countTrackerSetupPointsEvents: ${error.message}`);
  return count ?? 0;
}

/**
 * Distinct UTC calendar days (YYYY-MM-DD) with a daily_login event, excluding `excludeDay`
 * if provided (so the current award day is not counted for streak).
 */
export async function loadDailyLoginUtcDays(
  userId: string,
  excludeDay?: string,
): Promise<Set<string>> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('points_events')
    .select('created_at')
    .eq('user_id', userId)
    .eq('event_type', 'daily_login')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw new Error(`loadDailyLoginUtcDays: ${error.message}`);
  const set = new Set<string>();
  for (const r of data ?? []) {
    const day = String(r.created_at).slice(0, 10);
    if (excludeDay && day === excludeDay) continue;
    set.add(day);
  }
  return set;
}

export async function getPointsBreakdownForUser(
  userId: string,
): Promise<{ event_type: string; total: number }[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('points_events')
    .select('event_type, final_points')
    .eq('user_id', userId);
  if (error) throw new Error(`getPointsBreakdownForUser: ${error.message}`);
  const map = new Map<string, number>();
  for (const r of data ?? []) {
    const t = String((r as { event_type: string }).event_type);
    const v = num((r as { final_points: unknown }).final_points);
    map.set(t, (map.get(t) ?? 0) + v);
  }
  return [...map.entries()].map(([event_type, total]) => ({ event_type, total }));
}

export async function getTotalPointsForUser(userId: string): Promise<number> {
  const rows = await getPointsBreakdownForUser(userId);
  return rows.reduce((a, b) => a + b.total, 0);
}
