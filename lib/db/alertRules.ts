import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types';

export type AlertRuleRow = Tables<'alert_rules'>;

export async function listAlertRulesForUser(userId: string): Promise<AlertRuleRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listAlertRulesForUser failed: ${error.message}`);
  return data ?? [];
}

export async function listActivePulseLaunchpadRules(): Promise<AlertRuleRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('is_active', true)
    .eq('rule_type', 'pulse_launchpad');
  if (error) throw new Error(`listActivePulseLaunchpadRules failed: ${error.message}`);
  return data ?? [];
}

export async function getAlertRuleForUser(
  userId: string,
  id: string,
): Promise<AlertRuleRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('alert_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getAlertRuleForUser failed: ${error.message}`);
  return data;
}

export async function insertAlertRule(row: TablesInsert<'alert_rules'>): Promise<AlertRuleRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.from('alert_rules').insert(row).select('*').single();
  if (error) throw new Error(`insertAlertRule failed: ${error.message}`);
  return data;
}

export async function updateAlertRule(
  userId: string,
  id: string,
  patch: TablesUpdate<'alert_rules'>,
): Promise<AlertRuleRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('alert_rules')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`updateAlertRule failed: ${error.message}`);
  return data;
}

export async function deleteAlertRule(userId: string, id: string): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase.from('alert_rules').delete().eq('user_id', userId).eq('id', id);
  if (error) throw new Error(`deleteAlertRule failed: ${error.message}`);
}
