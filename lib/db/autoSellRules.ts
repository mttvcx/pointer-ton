import 'server-only';
/* eslint-disable @typescript-eslint/no-explicit-any -- auto_sell_rules not in generated types until types are regenerated */

import { createAdminSupabase } from '@/lib/supabase/server';

export function isMissingAutoSellTable(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  return /auto_sell_rules|does not exist|schema cache|42P01/i.test(err.message);
}

function throwIfMissing(error: { message: string }): never {
  if (/does not exist|schema cache|42P01|auto_sell_rules/i.test(String(error.message))) {
    throw new Error('missing_auto_sell_table');
  }
  throw new Error(error.message);
}

export type AutoSellRuleInsert = {
  user_id: string;
  name: string;
  trigger_type: string;
  trigger_config: unknown;
  sell_pct: number;
  token_scope: unknown;
  wallet_scope: string;
  cooldown_seconds: number;
  is_active: boolean;
};

export async function listAutoSellRulesForUser(userId: string): Promise<any[]> {
  const db = createAdminSupabase() as any;
  const { data, error } = await db
    .from('auto_sell_rules')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throwIfMissing(error);
  return (data ?? []) as any[];
}

export async function getAutoSellRuleForUser(userId: string, id: string): Promise<any | null> {
  const db = createAdminSupabase() as any;
  const { data, error } = await db
    .from('auto_sell_rules')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throwIfMissing(error);
  return data ?? null;
}

export async function insertAutoSellRule(row: AutoSellRuleInsert): Promise<any> {
  const db = createAdminSupabase() as any;
  const { data, error } = await db.from('auto_sell_rules').insert(row).select('*').single();
  if (error) throwIfMissing(error);
  return data;
}

export async function updateAutoSellRule(
  userId: string,
  id: string,
  patch: Partial<Omit<AutoSellRuleInsert, 'user_id'>>,
): Promise<any | null> {
  const db = createAdminSupabase() as any;
  const { data, error } = await db
    .from('auto_sell_rules')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .maybeSingle();
  if (error) throwIfMissing(error);
  return data ?? null;
}

export async function deleteAutoSellRule(userId: string, id: string): Promise<void> {
  const db = createAdminSupabase() as any;
  const { error } = await db.from('auto_sell_rules').delete().eq('user_id', userId).eq('id', id);
  if (error) throwIfMissing(error);
}
