import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';

export type MintIndexStatusState = 'indexing' | 'indexed' | 'no_swaps' | 'failed' | 'pending';

export type MintIndexStatusRow = {
  mint: string;
  status: MintIndexStatusState;
  last_started_at: string | null;
  last_indexed_at: string | null;
  swap_count: number | null;
  signature_count: number | null;
  wallet_count: number | null;
  top_trader_count: number | null;
  primary_pool: string | null;
  last_error: string | null;
  updated_at: string;
};

export type UpsertMintIndexStatusPatch = Partial<
  Omit<MintIndexStatusRow, 'mint' | 'updated_at'>
> & { mint: string };

export async function upsertMintIndexStatus(
  supabase: ReturnType<typeof createAdminSupabase>,
  patch: UpsertMintIndexStatusPatch,
): Promise<MintIndexStatusRow | null> {
  const now = new Date().toISOString();
  const payload = { ...patch, updated_at: now } as MintIndexStatusRow;
  const { data, error } = await supabase
    .from('mint_index_status')
    .upsert(payload, { onConflict: 'mint' })
    .select('*')
    .maybeSingle();
  if (error) {
    // Table may not exist yet (migration not applied) — treat as soft no-op.
    if (error.message?.includes('does not exist')) return null;
    throw new Error(`upsertMintIndexStatus failed: ${error.message}`);
  }
  return (data as MintIndexStatusRow | null) ?? null;
}

export async function getMintIndexStatus(
  mint: string,
): Promise<MintIndexStatusRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('mint_index_status')
    .select('*')
    .eq('mint', mint)
    .maybeSingle();
  if (error) {
    if (error.message?.includes('does not exist')) return null;
    return null;
  }
  return (data as MintIndexStatusRow | null) ?? null;
}

export async function listMintIndexStatuses(
  mints: string[],
): Promise<Map<string, MintIndexStatusRow>> {
  const map = new Map<string, MintIndexStatusRow>();
  if (mints.length === 0) return map;
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('mint_index_status')
    .select('*')
    .in('mint', mints);
  if (error) {
    if (error.message?.includes('does not exist')) return map;
    return map;
  }
  for (const row of (data ?? []) as MintIndexStatusRow[]) {
    map.set(row.mint, row);
  }
  return map;
}
