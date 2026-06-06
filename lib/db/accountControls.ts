import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Tables } from '@/lib/supabase/types';

export type AccountControlRow = Tables<'account_controls'>;

/** Scope of an emergency freeze. */
export type AccountControlScope = 'all' | 'trading' | 'automation';

const FREEZE_CACHE_MS = 10_000;
const freezeCache = new Map<string, { frozen: AccountControlRow | null; at: number }>();

function invalidateFreezeCache(userId?: string) {
  if (userId) freezeCache.delete(userId);
  else freezeCache.clear();
}

/** The user's currently-active (frozen) control, or null. Short-lived cache. */
export async function getActiveControl(userId: string): Promise<AccountControlRow | null> {
  const cached = freezeCache.get(userId);
  if (cached && Date.now() - cached.at < FREEZE_CACHE_MS) return cached.frozen;

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('account_controls')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'frozen')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getActiveControl failed: ${error.message}`);

  freezeCache.set(userId, { frozen: data ?? null, at: Date.now() });
  return data ?? null;
}

/** True if the user's `kind` of activity is currently frozen. */
export async function isActivityFrozen(
  userId: string,
  kind: 'trading' | 'automation',
): Promise<{ frozen: boolean; control: AccountControlRow | null }> {
  const control = await getActiveControl(userId);
  if (!control) return { frozen: false, control: null };
  const blocks = control.scope === 'all' || control.scope === kind;
  return { frozen: blocks, control: blocks ? control : null };
}

export async function listControlsForUser(userId: string, limit = 25): Promise<AccountControlRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('account_controls')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(Math.min(100, Math.max(1, limit)));
  if (error) throw new Error(`listControlsForUser failed: ${error.message}`);
  return data ?? [];
}

/**
 * Freeze a user. Idempotent: if an active freeze already exists it is returned
 * unchanged (the partial unique index also guards against duplicates).
 */
export async function freezeAccount(input: {
  targetUserId: string;
  scope: AccountControlScope;
  reason: string;
  createdByUserId: string | null;
}): Promise<AccountControlRow> {
  const existing = await getActiveControl(input.targetUserId);
  if (existing) return existing;

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('account_controls')
    .insert({
      user_id: input.targetUserId,
      status: 'frozen',
      scope: input.scope,
      reason: input.reason,
      created_by: input.createdByUserId,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`freezeAccount failed: ${error?.message}`);
  invalidateFreezeCache(input.targetUserId);
  return data;
}

/** Release the active freeze for a user. No-op-safe if none active. */
export async function releaseAccount(input: {
  targetUserId: string;
  reason: string;
  releasedByUserId: string | null;
}): Promise<AccountControlRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('account_controls')
    .update({
      status: 'released',
      released_by: input.releasedByUserId,
      released_reason: input.reason,
      released_at: new Date().toISOString(),
    })
    .eq('user_id', input.targetUserId)
    .eq('status', 'frozen')
    .select('*')
    .maybeSingle();
  if (error) throw new Error(`releaseAccount failed: ${error.message}`);
  invalidateFreezeCache(input.targetUserId);
  return data ?? null;
}
