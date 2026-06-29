import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types';

export type UserRow = Tables<'users'>;

export interface UserUpsertInput {
  privyId: string;
  walletAddress?: string | null;
  email?: string | null;
  username?: string | null;
}

/**
 * Idempotently insert/update a Pointer user keyed by Privy ID.
 *
 * Called from `/api/auth/sync` after a successful Privy access-token
 * verification. Returns the persisted row (with assigned uuid + timestamps).
 *
 * Conflict target: `privy_id` (unique). On conflict we patch wallet/email/
 * username so renaming or wallet linkage stays in sync.
 */
export async function upsertUserFromPrivy(input: UserUpsertInput): Promise<UserRow> {
  const supabase = createAdminSupabase();

  let walletAddress = input.walletAddress?.trim() || null;
  if (!walletAddress) {
    const existing = await getUserByPrivyId(input.privyId);
    if (
      existing?.wallet_address &&
      !existing.wallet_address.startsWith('privy:')
    ) {
      walletAddress = existing.wallet_address;
    }
  }

  // Do not send `tier_id` in the JSON body. Reasons:
  // 1) The DB column has `DEFAULT 'default'` per the Phase 1 schema, so new rows
  //    pick up the tier without an extra round-trip.
  // 2) If you added `tier_id` via migration and PostgREST has not reloaded its
  //    schema cache yet, referencing the column in the payload throws:
  //    "Could not find the tier_id column of users in the schema cache."
  //    Run `scripts/reload-postgrest-schema.sql` in the SQL editor after DDL.
  const insert: TablesInsert<'users'> = {
    privy_id: input.privyId,
    wallet_address: walletAddress ?? `privy:${input.privyId}`,
  };
  // Only write email/username when provided — otherwise an email-less re-sync
  // (e.g. a TonConnect refresh) would NULL out a previously-stored email and
  // silently break email-based admin bootstrap. Email is normalized lowercase so
  // ADMIN_BOOTSTRAP_EMAILS / subscription lookups match.
  const email = input.email?.trim().toLowerCase();
  if (email) insert.email = email;
  if (input.username != null) insert.username = input.username;

  const { data, error } = await supabase
    .from('users')
    .upsert(insert, { onConflict: 'privy_id' })
    .select('*')
    .single();

  if (error) throw new Error(`upsertUserFromPrivy failed: ${error.message}`);

  const [
    presetsResult,
    columnPresetsResult,
  ] = await Promise.allSettled([
    import('@/lib/db/presets').then(({ ensureDefaultTradingPresets }) =>
      ensureDefaultTradingPresets(data.id),
    ),
    import('@/lib/db/columnPresets').then(({ ensureDefaultColumnPresets }) =>
      ensureDefaultColumnPresets(data.id),
    ),
  ]);

  if (presetsResult.status === 'rejected') {
    console.warn(
      '[users] ensureDefaultTradingPresets:',
      presetsResult.reason instanceof Error ? presetsResult.reason.message : presetsResult.reason,
    );
  }
  if (columnPresetsResult.status === 'rejected') {
    console.warn(
      '[users] ensureDefaultColumnPresets:',
      columnPresetsResult.reason instanceof Error
        ? columnPresetsResult.reason.message
        : columnPresetsResult.reason,
    );
  }

  return data;
}

export async function getUserByPrivyId(privyId: string): Promise<UserRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('privy_id', privyId)
    .maybeSingle();
  if (error) throw new Error(`getUserByPrivyId failed: ${error.message}`);
  return data;
}

export async function getUserById(id: string): Promise<UserRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('users')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getUserById failed: ${error.message}`);
  return data;
}

export async function completeUserOnboarding(userId: string): Promise<UserRow> {
  return updateUser(userId, {
    onboarding_completed_at: new Date().toISOString(),
    onboarding_step: 3,
  });
}

export async function updateUser(
  id: string,
  patch: TablesUpdate<'users'>,
): Promise<UserRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('users')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`updateUser failed: ${error.message}`);
  return data;
}
