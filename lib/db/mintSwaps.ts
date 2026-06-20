import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import type { ParsedMintSwap } from '@/lib/indexer/types';

export type MintSwapRow = {
  id: number;
  mint: string;
  signature: string;
  wallet: string;
  event_kind: 'swap' | 'remove_liq' | 'add_liq';
  side: 'buy' | 'sell';
  token_amount_raw: number;
  token_amount_ui: number;
  sol_amount: number;
  usd_amount: number | null;
  price_usd: number | null;
  market_cap_usd: number | null;
  block_time: string;
  slot: number | null;
  program_id: string | null;
  pool_address: string | null;
  source: string;
  created_at: string;
};

export async function insertMintSwap(
  swap: ParsedMintSwap,
): Promise<'inserted' | 'duplicate' | 'error'> {
  const supabase = createAdminSupabase();
  const row = {
    mint: swap.mint,
    signature: swap.signature,
    wallet: swap.wallet,
    event_kind: swap.eventKind,
    side: swap.side,
    token_amount_raw: swap.tokenAmountRaw,
    token_amount_ui: swap.tokenAmountUi,
    sol_amount: swap.solAmount,
    usd_amount: swap.usdAmount,
    price_usd: swap.priceUsd,
    market_cap_usd: swap.marketCapUsd,
    block_time: swap.blockTime,
    slot: swap.slot,
    program_id: swap.programId,
    pool_address: swap.poolAddress,
    source: swap.source,
  };

  let { error } = await supabase.from('mint_swaps').insert(row);
  if (error?.message?.includes('event_kind')) {
    const { event_kind: _drop, ...legacy } = row;
    ({ error } = await supabase.from('mint_swaps').insert(legacy));
  }

  if (!error) return 'inserted';
  if (error.code === '23505') return 'duplicate';
  throw new Error(`insertMintSwap failed: ${error.message}`);
}

export async function listMintSwapsForMint(
  mint: string,
  limit: number,
): Promise<MintSwapRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('mint_swaps')
    .select('*')
    .eq('mint', mint)
    .order('block_time', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listMintSwapsForMint failed: ${error.message}`);
  return (data ?? []) as MintSwapRow[];
}

export async function listMintSwapsForMintAsc(
  mint: string,
  limit = 20_000,
): Promise<MintSwapRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('mint_swaps')
    .select('*')
    .eq('mint', mint)
    .order('block_time', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`listMintSwapsForMintAsc failed: ${error.message}`);
  return (data ?? []) as MintSwapRow[];
}

/** Swaps for one wallet on a mint (indexed tape / desk stats). */
export async function listMintSwapsForWallet(
  mint: string,
  wallet: string,
  limit = 5_000,
): Promise<MintSwapRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('mint_swaps')
    .select('*')
    .eq('mint', mint)
    .eq('wallet', wallet)
    .order('block_time', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`listMintSwapsForWallet failed: ${error.message}`);
  return (data ?? []) as MintSwapRow[];
}

/**
 * All swaps for one wallet across EVERY mint (wallet-centric analytics),
 * paginated past PostgREST's 1000-row cap. Optionally windowed by block_time.
 * Ordered by `id` (stable/unique) so range pagination can't skip or dupe.
 */
export async function listAllSwapsForWallet(
  wallet: string,
  opts?: { sinceIso?: string },
): Promise<MintSwapRow[]> {
  const supabase = createAdminSupabase();
  const PAGE = 1000;
  const out: MintSwapRow[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = supabase.from('mint_swaps').select('*').eq('wallet', wallet);
    if (opts?.sinceIso) query = query.gte('block_time', opts.sinceIso);
    const { data, error } = await query
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`listAllSwapsForWallet failed: ${error.message}`);
    const rows = (data ?? []) as MintSwapRow[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}

export async function countMintSwaps(mint: string): Promise<number> {
  const supabase = createAdminSupabase();
  const { count, error } = await supabase
    .from('mint_swaps')
    .select('id', { count: 'exact', head: true })
    .eq('mint', mint);
  if (error) throw new Error(`countMintSwaps failed: ${error.message}`);
  return count ?? 0;
}

/** Swaps since ISO timestamp (for global wallet_stats aggregation). */
export async function listMintSwapsSince(
  sinceIso: string,
  limit = 100_000,
): Promise<MintSwapRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('mint_swaps')
    .select('*')
    .gte('block_time', sinceIso)
    .order('block_time', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`listMintSwapsSince failed: ${error.message}`);
  return (data ?? []) as MintSwapRow[];
}

/**
 * All swaps since `sinceIso`, paginated past PostgREST's 1000-row cap.
 * Orders by `id` (stable/unique) so range pagination can't skip or dupe rows.
 */
export async function listAllMintSwapsSince(sinceIso: string): Promise<MintSwapRow[]> {
  const supabase = createAdminSupabase();
  const PAGE = 1000;
  const out: MintSwapRow[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('mint_swaps')
      .select('*')
      .gte('block_time', sinceIso)
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (error) throw new Error(`listAllMintSwapsSince failed: ${error.message}`);
    const rows = (data ?? []) as MintSwapRow[];
    out.push(...rows);
    if (rows.length < PAGE) break;
  }
  return out;
}
