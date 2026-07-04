import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';

/**
 * KOL CA history — the contract addresses a handle has posted, accumulated from
 * the tweets the extension already scans as users browse. Pointer's own dataset
 * (public tweet facts), grows for free, no third-party API. One row per
 * (handle, mint); first_seen is when we first observed it.
 */

const norm = (h: string) => h.replace(/^@/, '').trim().toLowerCase();

// kol_cas is newly created and not in the generated Supabase types yet.
interface CaRow {
  mint: string;
  chain: string;
  first_seen: string;
}
interface CaTable {
  upsert: (v: Record<string, unknown>[], o: { onConflict: string; ignoreDuplicates: boolean }) => Promise<{ error: { message: string } | null }>;
  select: (c: string) => { eq: (col: string, val: string) => { order: (col: string, o: { ascending: boolean }) => { limit: (n: number) => Promise<{ data: CaRow[] | null }> } } };
}
function table(): CaTable {
  return (createAdminSupabase() as unknown as { from: (t: string) => CaTable }).from('kol_cas');
}

export async function submitKolCas(handle: string, cas: { mint: string; chain?: string }[]): Promise<number> {
  const h = norm(handle);
  const rows = cas
    .filter((c) => c.mint && c.mint.length >= 32)
    .slice(0, 50)
    .map((c) => ({ handle: h, mint: c.mint.trim(), chain: c.chain === 'evm' || c.chain === 'eth' ? 'eth' : 'sol' }));
  if (!h || !rows.length) return 0;
  const { error } = await table().upsert(rows, { onConflict: 'handle,mint', ignoreDuplicates: true });
  if (error) throw new Error(`kol_cas_submit_failed: ${error.message}`);
  return rows.length;
}

export async function getKolCas(handle: string, limit = 12): Promise<{ mint: string; chain: string; firstSeen: string }[]> {
  try {
    const { data } = await table().select('mint, chain, first_seen').eq('handle', norm(handle)).order('first_seen', { ascending: false }).limit(limit);
    return (data ?? []).map((r) => ({ mint: r.mint, chain: r.chain, firstSeen: r.first_seen }));
  } catch {
    return [];
  }
}
