import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types';

export type LimitOrderRow = Tables<'limit_orders'>;

export async function insertLimitOrder(row: TablesInsert<'limit_orders'>): Promise<LimitOrderRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('limit_orders')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`insertLimitOrder failed: ${error.message}`);
  return data;
}

export async function updateLimitOrder(
  id: string,
  userId: string,
  patch: TablesUpdate<'limit_orders'>,
): Promise<LimitOrderRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('limit_orders')
    .update(patch)
    .eq('id', id)
    .eq('user_id', userId)
    .select('*')
    .single();
  if (error) throw new Error(`updateLimitOrder failed: ${error.message}`);
  return data;
}

export async function getLimitOrderForUser(
  id: string,
  userId: string,
): Promise<LimitOrderRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('limit_orders')
    .select('*')
    .eq('id', id)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(`getLimitOrderForUser failed: ${error.message}`);
  return data ?? null;
}

export async function cancelLimitOrder(id: string, userId: string): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('limit_orders')
    .update({ status: 'cancelled' })
    .eq('id', id)
    .eq('user_id', userId)
    .in('status', ['open', 'triggered']);
  if (error) throw new Error(`cancelLimitOrder failed: ${error.message}`);
}

export async function listLimitOrdersForUser(
  userId: string,
  opts?: { mint?: string; status?: string[] },
): Promise<LimitOrderRow[]> {
  const supabase = createAdminSupabase();
  let q = supabase.from('limit_orders').select('*').eq('user_id', userId);
  if (opts?.mint) q = q.eq('mint', opts.mint);
  if (opts?.status?.length) q = q.in('status', opts.status);
  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) throw new Error(`listLimitOrdersForUser failed: ${error.message}`);
  return data ?? [];
}

/** Open + triggered limit alerts for a mint (all users). */
export async function listOpenLimitOrdersForMint(mint: string): Promise<LimitOrderRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('limit_orders')
    .select('*')
    .eq('mint', mint)
    .in('status', ['open', 'triggered'])
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listOpenLimitOrdersForMint failed: ${error.message}`);
  return data ?? [];
}

export async function listOpenLimitOrdersCron(): Promise<LimitOrderRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.from('limit_orders').select('*').eq('status', 'open');
  if (error) throw new Error(`listOpenLimitOrdersCron failed: ${error.message}`);
  return data ?? [];
}

export async function markLimitOrderTriggered(
  id: string,
  priceAtFire: number,
): Promise<LimitOrderRow> {
  const supabase = createAdminSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('limit_orders')
    .update({
      status: 'triggered',
      triggered_at: now,
      trigger_price_usd_at_fire: priceAtFire,
    })
    .eq('id', id)
    .eq('status', 'open')
    .select('*')
    .single();
  if (error) throw new Error(`markLimitOrderTriggered failed: ${error.message}`);
  return data;
}

/** Mark open orders past expires_at as expired. */
export async function expireDueLimitOrders(): Promise<number> {
  const supabase = createAdminSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('limit_orders')
    .update({ status: 'expired' })
    .eq('status', 'open')
    .not('expires_at', 'is', null)
    .lt('expires_at', now)
    .select('id');
  if (error) throw new Error(`expireDueLimitOrders failed: ${error.message}`);
  return data?.length ?? 0;
}
