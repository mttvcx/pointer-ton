import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import { isUniqueViolation } from '@/lib/db/pgError';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types';

export type TradeRow = Tables<'trades'>;

export async function getTradeByIdForUser(
  userId: string,
  tradeId: string,
): Promise<TradeRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .eq('id', tradeId)
    .maybeSingle();
  if (error) throw new Error(`getTradeByIdForUser failed: ${error.message}`);
  return data;
}

export async function insertTrade(row: TablesInsert<'trades'>): Promise<TradeRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('trades')
    .insert(row)
    .select('*')
    .single();
  if (error) {
    // Idempotency boundary (BLOCKER-2): `trades.tx_signature` carries a UNIQUE
    // index. A concurrent/retried submit of the SAME signature loses the insert
    // race with 23505 — converge on the winner's row so downstream cashback +
    // referral (keyed on trade.id) dedupe to exactly-once instead of double-paying.
    if (isUniqueViolation(error) && row.tx_signature) {
      const existing = await getTradeBySignature(row.tx_signature);
      if (existing) return existing;
    }
    throw new Error(`insertTrade failed: ${error.message}`);
  }
  if (!data) throw new Error('insertTrade failed: no row returned');
  return data;
}

export async function updateTradeBySignature(
  txSignature: string,
  patch: TablesUpdate<'trades'>,
): Promise<TradeRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('trades')
    .update(patch)
    .eq('tx_signature', txSignature)
    .select('*')
    .single();
  if (error) throw new Error(`updateTradeBySignature failed: ${error.message}`);
  return data;
}

export async function getTradeBySignature(
  txSignature: string,
): Promise<TradeRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('tx_signature', txSignature)
    .maybeSingle();
  if (error) throw new Error(`getTradeBySignature failed: ${error.message}`);
  return data;
}

export async function listTradesForUser(
  userId: string,
  limit: number,
): Promise<TradeRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .order('submitted_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listTradesForUser failed: ${error.message}`);
  return data ?? [];
}

/** Confirmed fills oldest-first for cost-basis / PnL (FIFO). */
export async function listConfirmedTradesForUserAsc(
  userId: string,
  limit: number,
): Promise<TradeRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .order('submitted_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`listConfirmedTradesForUserAsc failed: ${error.message}`);
  return data ?? [];
}

export async function countConfirmedTradesForUser(userId: string): Promise<number> {
  const supabase = createAdminSupabase();
  const { count, error } = await supabase
    .from('trades')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('status', 'confirmed');
  if (error) throw new Error(`countConfirmedTradesForUser failed: ${error.message}`);
  return count ?? 0;
}

export async function listConfirmedTradesForMintUserAsc(
  mint: string,
  userId: string,
  limit: number,
): Promise<TradeRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('mint', mint)
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .order('submitted_at', { ascending: true })
    .limit(limit);
  if (error) throw new Error(`listConfirmedTradesForMintUserAsc failed: ${error.message}`);
  return data ?? [];
}

export async function listTradesForMint(
  mint: string,
  limit: number,
): Promise<TradeRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('mint', mint)
    .order('submitted_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listTradesForMint failed: ${error.message}`);
  return data ?? [];
}

export async function listTradesForMintSince(
  mint: string,
  sinceIso: string,
  limit: number,
): Promise<TradeRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('trades')
    .select('*')
    .eq('mint', mint)
    .gte('submitted_at', sinceIso)
    .order('submitted_at', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listTradesForMintSince failed: ${error.message}`);
  return data ?? [];
}

/** Platform-wide SOL notional from confirmed trades (rough volume proxy) since UTC midnight. */
export async function sumConfirmedTradeVolumeSolUtcToday(): Promise<number> {
  const supabase = createAdminSupabase();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('trades')
    .select('amount_sol')
    .eq('status', 'confirmed')
    .gte('submitted_at', start.toISOString());
  if (error) throw new Error(`sumConfirmedTradeVolumeSolUtcToday failed: ${error.message}`);
  let sum = 0;
  for (const r of data ?? []) {
    if (r.amount_sol != null && Number.isFinite(r.amount_sol)) sum += r.amount_sol;
  }
  return sum;
}

/** Sum realized PnL proxy: today's confirmed sells minus buys in SOL (simplified). */
export async function sumUserRealizedSolToday(userId: string): Promise<number> {
  const supabase = createAdminSupabase();
  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const { data, error } = await supabase
    .from('trades')
    .select('side, amount_sol')
    .eq('user_id', userId)
    .eq('status', 'confirmed')
    .gte('submitted_at', start.toISOString());
  if (error) throw new Error(`sumUserRealizedSolToday failed: ${error.message}`);
  let net = 0;
  for (const r of data ?? []) {
    const a = r.amount_sol ?? 0;
    if (r.side === 'sell') net += a;
    else net -= a;
  }
  return net;
}
