import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import type { Tables, TablesInsert } from '@/lib/supabase/types';

export type AnnouncementRow = Tables<'announcements'>;

/** Next announcement that is live and not dismissed by this user (latest first). */
export async function getPendingAnnouncementForUser(userId: string): Promise<AnnouncementRow | null> {
  const supabase = createAdminSupabase();
  const now = new Date().toISOString();

  const { data: rows, error } = await supabase
    .from('announcements')
    .select('*')
    .lte('show_from', now)
    .or(`show_until.is.null,show_until.gt.${now}`)
    .order('show_from', { ascending: false });

  if (error) throw new Error(`getPendingAnnouncementForUser failed: ${error.message}`);
  const list = rows ?? [];
  if (list.length === 0) return null;

  const { data: dismissed, error: dErr } = await supabase
    .from('user_announcement_dismissals')
    .select('announcement_id')
    .eq('user_id', userId);

  if (dErr) throw new Error(`getPendingAnnouncementForUser dismissals: ${dErr.message}`);
  const dismissedSet = new Set((dismissed ?? []).map((r) => r.announcement_id));

  for (const row of list) {
    if (!dismissedSet.has(row.id)) return row;
  }
  return null;
}

export async function dismissAnnouncementForUser(
  userId: string,
  announcementId: string,
): Promise<void> {
  const supabase = createAdminSupabase();
  const insert: TablesInsert<'user_announcement_dismissals'> = {
    user_id: userId,
    announcement_id: announcementId,
  };
  const { error } = await supabase.from('user_announcement_dismissals').upsert(insert, {
    onConflict: 'user_id,announcement_id',
  });
  if (error) throw new Error(`dismissAnnouncementForUser failed: ${error.message}`);
}
