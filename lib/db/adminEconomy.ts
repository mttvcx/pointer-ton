import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Json, Tables } from '@/lib/supabase/types';

export type CashbackLedgerRow = Tables<'cashback_ledger'>;

/**
 * Manual admin points grant. Inserts directly into `points_events` with
 * event_type 'admin_grant' and multiplier 1 so the granted amount lands
 * exactly (no tier multiplier applied to discretionary grants).
 */
export async function adminGrantPoints(input: {
  userId: string;
  amount: number;
  reason: string;
  grantedByLabel: string;
  dedupeKey: string;
}): Promise<void> {
  if (!(input.amount > 0)) throw new Error('amount_must_be_positive');
  const supabase = createAdminSupabase();
  const metadata: Json = {
    dedupe_key: input.dedupeKey,
    reason: input.reason,
    granted_by: input.grantedByLabel,
    admin_grant: true,
  };
  const { error } = await supabase.from('points_events').insert({
    user_id: input.userId,
    event_type: 'admin_grant',
    base_points: input.amount,
    multiplier: 1,
    metadata,
  });
  if (error) throw new Error(`adminGrantPoints failed: ${error.message}`);
}

export async function setUserTier(userId: string, tierId: string): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase.from('users').update({ tier_id: tierId }).eq('id', userId);
  if (error) throw new Error(`setUserTier failed: ${error.message}`);
}

export async function grantCashback(input: {
  userId: string;
  amountSol: number;
  reason: string;
  createdByUserId: string | null;
}): Promise<CashbackLedgerRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('cashback_ledger')
    .insert({
      user_id: input.userId,
      amount_sol: input.amountSol,
      kind: 'grant',
      reason: input.reason,
      status: 'available',
      created_by: input.createdByUserId,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`grantCashback failed: ${error?.message}`);
  return data;
}

export async function getCashbackBalanceSol(userId: string): Promise<number> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('cashback_ledger')
    .select('amount_sol, status')
    .eq('user_id', userId);
  if (error) throw new Error(`getCashbackBalanceSol failed: ${error.message}`);
  let sum = 0;
  for (const r of data ?? []) {
    if (r.status === 'void') continue;
    const n = Number(r.amount_sol);
    if (Number.isFinite(n)) sum += n;
  }
  return sum;
}
