import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';

export async function insertBetaCodeRow(createdByUserId: string, codeHash: string): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase.from('beta_codes').insert({
    code_hash: codeHash,
    created_by_user_id: createdByUserId,
  });
  if (error) throw new Error(`insertBetaCodeRow: ${error.message}`);
}

/** Returns true if this user was the first to consume this unused code. */
export async function tryConsumeBetaCode(codeHash: string, userId: string): Promise<boolean> {
  const supabase = createAdminSupabase();
  const now = new Date().toISOString();
  const { data: row, error: selErr } = await supabase
    .from('beta_codes')
    .select('id')
    .eq('code_hash', codeHash)
    .is('used_by_user_id', null)
    .maybeSingle();
  if (selErr) throw new Error(`tryConsumeBetaCode select: ${selErr.message}`);
  if (!row) return false;
  const { data: updated, error: upErr } = await supabase
    .from('beta_codes')
    .update({ used_by_user_id: userId, used_at: now })
    .eq('id', row.id)
    .is('used_by_user_id', null)
    .select('id')
    .maybeSingle();
  if (upErr) throw new Error(`tryConsumeBetaCode update: ${upErr.message}`);
  return Boolean(updated);
}
