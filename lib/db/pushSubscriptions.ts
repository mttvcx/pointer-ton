import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import type { Tables, TablesInsert } from '@/lib/supabase/types';

export type PushSubscriptionRow = Tables<'push_subscriptions'>;

export async function upsertPushSubscription(
  row: Omit<TablesInsert<'push_subscriptions'>, 'id' | 'created_at' | 'updated_at'>,
): Promise<PushSubscriptionRow> {
  const supabase = createAdminSupabase();
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('push_subscriptions')
    .upsert(
      {
        ...row,
        updated_at: now,
      },
      { onConflict: 'user_id,endpoint' },
    )
    .select('*')
    .single();
  if (error) throw new Error(`upsertPushSubscription failed: ${error.message}`);
  return data;
}

export async function listPushSubscriptionsForUser(userId: string): Promise<PushSubscriptionRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('push_subscriptions')
    .select('*')
    .eq('user_id', userId);
  if (error) throw new Error(`listPushSubscriptionsForUser failed: ${error.message}`);
  return data ?? [];
}

export async function deletePushSubscriptionByEndpoint(
  userId: string,
  endpoint: string,
): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('endpoint', endpoint);
  if (error) throw new Error(`deletePushSubscriptionByEndpoint failed: ${error.message}`);
}

export async function deletePushSubscriptionById(userId: string, id: string): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', userId)
    .eq('id', id);
  if (error) throw new Error(`deletePushSubscriptionById failed: ${error.message}`);
}
