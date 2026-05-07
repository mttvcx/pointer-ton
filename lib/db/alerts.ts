import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Json, Tables, TablesInsert } from '@/lib/supabase/types';

export type AlertRow = Tables<'alerts'>;

export async function insertAlert(row: TablesInsert<'alerts'>): Promise<AlertRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('alerts')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`insertAlert failed: ${error.message}`);
  return data;
}

export async function getAlertById(id: string): Promise<AlertRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getAlertById failed: ${error.message}`);
  return data;
}

export async function updateAlertNarration(
  id: string,
  narration: string | null,
): Promise<AlertRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('alerts')
    .update({ ai_narration: narration })
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`updateAlertNarration failed: ${error.message}`);
  return data;
}

/**
 * In-app ticker: own alerts plus global broadcasts (`user_id` IS NULL).
 */
export async function listAlertsForTicker(
  userId: string,
  limit: number,
): Promise<AlertRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('alerts')
    .select('*')
    .or(`user_id.eq.${userId},user_id.is.null`)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listAlertsForTicker failed: ${error.message}`);
  return data ?? [];
}

export type { Json };
