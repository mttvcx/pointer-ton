import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';

/**
 * Pointer subscription reader. The `subscriptions` table is created by
 * `scripts/subscriptions.sql` (a row per user with status + period end). Until
 * that migration is applied the query errors and we return null gracefully — the
 * holdings path still grants AI access, so nothing breaks pre-migration.
 */

export type ActiveSubscription = { plan: string; expiresAt: string | null };

export async function getActiveSubscription(userId: string): Promise<ActiveSubscription | null> {
  try {
    const supabase = createAdminSupabase();
    // The table isn't in the generated types yet (added by migration) — query
    // through an untyped `from` (select → any) so this compiles before regeneration.
    const fromAny = supabase.from as unknown as (t: string) => { select: (cols: string) => any };
    const { data, error } = await fromAny('subscriptions')
      .select('plan, status, current_period_end')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('current_period_end', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error || !data) return null;
    const row = data as { plan?: string; current_period_end?: string | null };
    if (row.current_period_end && new Date(row.current_period_end).getTime() < Date.now()) {
      return null; // lapsed
    }
    return { plan: row.plan ?? 'pro', expiresAt: row.current_period_end ?? null };
  } catch {
    return null;
  }
}

export async function hasActiveSubscription(userId: string): Promise<boolean> {
  return (await getActiveSubscription(userId)) != null;
}
