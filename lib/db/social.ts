import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Tables, TablesInsert } from '@/lib/supabase/types';

export type SocialMentionRow = Tables<'social_mentions'>;

export async function insertSocialMention(
  row: TablesInsert<'social_mentions'>,
): Promise<SocialMentionRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('social_mentions')
    .insert(row)
    .select('*')
    .single();
  if (error) throw new Error(`insertSocialMention failed: ${error.message}`);
  return data;
}

export async function listRecentSocialForMint(
  mint: string,
  limit: number,
): Promise<SocialMentionRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('social_mentions')
    .select('*')
    .eq('mint', mint)
    .order('posted_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`listRecentSocialForMint failed: ${error.message}`);
  return data ?? [];
}

export async function listSocialMentionsSince(
  mint: string,
  sinceIso: string,
  limit: number,
): Promise<SocialMentionRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('social_mentions')
    .select('*')
    .eq('mint', mint)
    .gte('posted_at', sinceIso)
    .order('posted_at', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw new Error(`listSocialMentionsSince failed: ${error.message}`);
  return data ?? [];
}

/** Alias for `explainToken` (callers convert e.g. "30 minutes" to ISO). */
export const getRecentSocialMentions = listSocialMentionsSince;
