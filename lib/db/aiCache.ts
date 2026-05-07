import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Json, Tables, TablesInsert } from '@/lib/supabase/types';

export type AiResponseRow = Tables<'ai_responses'>;

export async function insertAiResponse(
  row: TablesInsert<'ai_responses'>,
): Promise<AiResponseRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('ai_responses')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`insertAiResponse failed: ${error.message}`);
  return data;
}

export async function findAiResponseByCacheKey(
  cacheKey: string,
): Promise<AiResponseRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('ai_responses')
    .select('*')
    .eq('cache_key', cacheKey)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`findAiResponseByCacheKey failed: ${error.message}`);
  return data;
}

export type { Json };
