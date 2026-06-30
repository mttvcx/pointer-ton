import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';

/**
 * Smart followers — which of an account's followers are known KOLs in Pointer's
 * directory. Built as users browse a handle's followers page: the extension
 * submits the @handles X rendered, we cross-reference identity_profiles and keep
 * the matches. Pointer's own dataset from public X data + our directory.
 */

const norm = (h: string) => h.replace(/^@/, '').trim().toLowerCase();
function badgeFor(cat: string | null): string | null {
  if (!cat) return null;
  const c = cat.toLowerCase();
  return c === 'kol' ? 'KOL' : c.charAt(0).toUpperCase() + c.slice(1);
}

// kol_smart_followers is newly created and not in the generated types yet.
interface KsfTable {
  upsert: (v: Record<string, unknown>[], o: { onConflict: string; ignoreDuplicates: boolean }) => Promise<{ error: { message: string } | null }>;
  select: (c: string, o?: { count: 'exact'; head: true }) => {
    eq: (col: string, val: string) => { limit: (n: number) => Promise<{ data: { follower_handle: string }[] | null; count: number | null }> };
  };
}
function ksf(): KsfTable {
  return (createAdminSupabase() as unknown as { from: (t: string) => KsfTable }).from('kol_smart_followers');
}

/** Cross-reference submitted followers with the directory; store the KOLs and
 *  backfill their avatar (from the pic X rendered) where we don't have one. */
export async function submitSmartFollowers(handle: string, followers: { handle: string; avatar?: string }[]): Promise<number> {
  const h = norm(handle);
  const avatarByHandle = new Map<string, string | undefined>();
  for (const f of followers) {
    const fh = norm(f.handle);
    if (fh && fh !== h) avatarByHandle.set(fh, f.avatar);
  }
  const fl = [...avatarByHandle.keys()].slice(0, 60);
  if (!h || !fl.length) return 0;

  const supabase = createAdminSupabase();
  const orFilter = fl.map((f) => `twitter_handle.ilike.${f}`).join(',');
  const { data: known } = await supabase.from('identity_profiles').select('id, twitter_handle, avatar_url').or(orFilter).limit(200);
  const knownRows = (known ?? []).map((k) => ({ id: k.id as string, h: norm(k.twitter_handle ?? ''), hasAvatar: !!(k as { avatar_url?: string }).avatar_url }));
  const knownSet = new Set(knownRows.map((k) => k.h));
  const rows = fl.filter((f) => knownSet.has(f)).map((f) => ({ handle: h, follower_handle: f }));
  if (!rows.length) return 0;

  const { error } = await ksf().upsert(rows, { onConflict: 'handle,follower_handle', ignoreDuplicates: true });
  if (error) throw new Error(`ksf_submit_failed: ${error.message}`);

  // backfill avatars for known KOLs missing one
  await Promise.all(
    knownRows
      .filter((k) => !k.hasAvatar && avatarByHandle.get(k.h))
      .map((k) => supabase.from('identity_profiles').update({ avatar_url: avatarByHandle.get(k.h) ?? null }).eq('id', k.id)),
  ).catch(() => undefined);

  return rows.length;
}

export interface SmartFollower {
  handle: string;
  name: string;
  badge: string | null;
  avatar: string | null;
}

export async function getSmartFollowers(handle: string, limit = 30): Promise<{ count: number; list: SmartFollower[] }> {
  try {
    const { data: rows, count } = await ksf().select('follower_handle', { count: 'exact', head: false } as never).eq('handle', norm(handle)).limit(limit);
    const fl = (rows ?? []).map((r) => r.follower_handle);
    if (!fl.length) return { count: count ?? 0, list: [] };

    const supabase = createAdminSupabase();
    const orFilter = fl.map((f) => `twitter_handle.ilike.${f}`).join(',');
    const { data: profs } = await supabase.from('identity_profiles').select('twitter_handle, display_name, primary_category, avatar_url').or(orFilter).limit(100);
    const byHandle = new Map((profs ?? []).map((p) => [norm(p.twitter_handle ?? ''), p]));
    const list: SmartFollower[] = fl.map((f) => {
      const p = byHandle.get(f) as { display_name: string | null; primary_category: string | null; avatar_url?: string | null } | undefined;
      return { handle: f, name: p?.display_name ?? f, badge: badgeFor(p?.primary_category ?? null), avatar: p?.avatar_url ?? null };
    });
    return { count: count ?? list.length, list };
  } catch {
    return { count: 0, list: [] };
  }
}
