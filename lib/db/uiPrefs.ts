import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';

/**
 * Per-user workspace/layout preferences (see scripts/user-ui-prefs.sql). The
 * table isn't in the generated Supabase types yet, so we go through an untyped
 * client. Reads/writes are best-effort — a missing table (migration not applied)
 * degrades to "no synced prefs", never an error to the client.
 */

export type UiPrefsBlob = Record<string, string>;

/** Load a user's saved layout blob, or null if none / table absent. */
export async function getUiPrefs(userId: string): Promise<UiPrefsBlob | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await (supabase as unknown as {
    from: (t: string) => {
      select: (c: string) => {
        eq: (k: string, v: string) => { maybeSingle: () => Promise<{ data: { prefs: unknown } | null; error: { message: string } | null }> };
      };
    };
  })
    .from('user_ui_prefs')
    .select('prefs')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) return null; // table missing / transient — treat as no prefs
  const prefs = data?.prefs;
  if (!prefs || typeof prefs !== 'object') return null;
  return prefs as UiPrefsBlob;
}

/** Upsert a user's layout blob. Returns false on failure (best-effort). */
export async function upsertUiPrefs(userId: string, prefs: UiPrefsBlob): Promise<boolean> {
  const supabase = createAdminSupabase();
  const { error } = await (supabase as unknown as {
    from: (t: string) => {
      upsert: (row: Record<string, unknown>, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
    };
  })
    .from('user_ui_prefs')
    .upsert(
      { user_id: userId, prefs, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' },
    );

  return !error;
}
