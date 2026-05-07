import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import { getPointMultiplierForUser } from '@/lib/db/tiers';
import type { Json, Tables, TablesInsert } from '@/lib/supabase/types';

export type UserPointRow = Tables<'user_points'>;

/**
 * Award "potential rewards" points. Phase 1 inserts rows only (no UI).
 * `amount` is multiplied by the user's tier `point_multiplier`.
 */
export async function awardPoints(
  userId: string,
  source: string,
  amount: number,
  metadata?: Json | null,
): Promise<UserPointRow> {
  const multiplier = await getPointMultiplierForUser(userId);
  const adjusted = Number(amount) * multiplier;

  const supabase = createAdminSupabase();
  const row: TablesInsert<'user_points'> = {
    user_id: userId,
    source,
    amount: adjusted,
    metadata: metadata ?? null,
  };
  const { data, error } = await supabase
    .from('user_points')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`awardPoints failed: ${error.message}`);
  return data;
}

export async function listRecentPointsForUser(
  userId: string,
  limit: number,
): Promise<UserPointRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('user_points')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listRecentPointsForUser failed: ${error.message}`);
  return data ?? [];
}

export type { Json };
