import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';

/**
 * Refreshes the `points_leaderboard` materialized view.
 * Requires SQL function `refresh_points_leaderboard` (see scripts).
 */
export async function refreshPointsLeaderboardView(): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase.rpc('refresh_points_leaderboard');
  if (error) throw new Error(`refresh_points_leaderboard: ${error.message}`);
}
