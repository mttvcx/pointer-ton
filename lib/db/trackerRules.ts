import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import type { Json, Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types';

export type TrackerRuleRow = Tables<'tracker_rules'>;

export async function listTrackerRulesForWallet(
  userId: string,
  trackedWalletId: string,
): Promise<TrackerRuleRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('tracker_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('tracked_wallet_id', trackedWalletId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listTrackerRulesForWallet failed: ${error.message}`);
  return data ?? [];
}

export async function listEnabledTrackerRulesForWallet(
  trackedWalletId: string,
): Promise<TrackerRuleRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('tracker_rules')
    .select('*')
    .eq('tracked_wallet_id', trackedWalletId)
    .eq('enabled', true)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listEnabledTrackerRulesForWallet failed: ${error.message}`);
  return data ?? [];
}

export async function getTrackerRuleForUser(
  userId: string,
  ruleId: string,
): Promise<TrackerRuleRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('tracker_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('id', ruleId)
    .maybeSingle();
  if (error) throw new Error(`getTrackerRuleForUser failed: ${error.message}`);
  return data;
}

export async function insertTrackerRule(
  row: TablesInsert<'tracker_rules'>,
): Promise<TrackerRuleRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('tracker_rules')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`insertTrackerRule failed: ${error.message}`);
  return data;
}

export async function updateTrackerRule(
  userId: string,
  ruleId: string,
  patch: TablesUpdate<'tracker_rules'>,
): Promise<TrackerRuleRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('tracker_rules')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', ruleId)
    .select('*')
    .single();
  if (error) throw new Error(`updateTrackerRule failed: ${error.message}`);
  return data;
}

export async function deleteTrackerRule(userId: string, ruleId: string): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('tracker_rules')
    .delete()
    .eq('user_id', userId)
    .eq('id', ruleId);
  if (error) throw new Error(`deleteTrackerRule failed: ${error.message}`);
}

export type { Json };
