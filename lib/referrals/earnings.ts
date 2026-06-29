import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import { referralFeeShareBps } from '@/lib/referrals/constants';
import { isReferralEnabled } from '@/lib/emergency/controls';
import type { Tables, TablesInsert } from '@/lib/supabase/types';

export type ReferralRow = Tables<'referrals'>;
export type ReferralEarningRow = Tables<'referral_earnings'>;

export async function getReferralByReferred(referredId: string): Promise<ReferralRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('referrals')
    .select('*')
    .eq('referred_id', referredId)
    .maybeSingle();
  if (error) throw new Error(`getReferralByReferred: ${error.message}`);
  return data;
}

export async function countReferralsForReferrer(referrerId: string): Promise<number> {
  const supabase = createAdminSupabase();
  const { count, error } = await supabase
    .from('referrals')
    .select('*', { count: 'exact', head: true })
    .eq('referrer_id', referrerId);
  if (error) throw new Error(`countReferralsForReferrer: ${error.message}`);
  return count ?? 0;
}

export async function createReferralApply(input: {
  referrerId: string;
  referredId: string;
  code: string;
}): Promise<ReferralRow> {
  const supabase = createAdminSupabase();
  const row: TablesInsert<'referrals'> = {
    referrer_id: input.referrerId,
    referred_id: input.referredId,
    code: input.code,
  };
  const { data, error } = await supabase.from('referrals').insert(row).select('*').single();
  if (error) throw new Error(`createReferralApply: ${error.message}`);
  return data;
}

export async function incrementReferralCodeUses(code: string): Promise<void> {
  const supabase = createAdminSupabase();
  const { data: row } = await supabase
    .from('referral_codes')
    .select('uses_count')
    .eq('code', code)
    .maybeSingle();
  if (!row) return;
  const next = Number(row.uses_count) + 1;
  const { error } = await supabase.from('referral_codes').update({ uses_count: next }).eq('code', code);
  if (error) throw new Error(`incrementReferralCodeUses: ${error.message}`);
}

async function hasEarningForTrade(tradeId: string): Promise<boolean> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('referral_earnings')
    .select('id')
    .eq('trade_id', tradeId)
    .maybeSingle();
  if (error) throw new Error(`hasEarningForTrade: ${error.message}`);
  return data != null;
}

/**
 * Credit referrer with `referralFeeShareBps` of the platform fee on this trade.
 */
export async function recordReferralEarningFromTrade(input: {
  referredUserId: string;
  tradeId: string;
  platformFeeLamports: number;
}): Promise<void> {
  // Emergency referral kill switch — SKIP accrual (never fail the parent trade).
  if (!(await isReferralEnabled())) return;
  if (!(input.platformFeeLamports > 0)) return;
  if (await hasEarningForTrade(input.tradeId)) return;

  const ref = await getReferralByReferred(input.referredUserId);
  if (!ref) return;
  if (ref.referrer_id === input.referredUserId) return;

  const bps = referralFeeShareBps();
  const amount = Math.floor((input.platformFeeLamports * bps) / 10_000);
  if (!(amount > 0)) return;

  const supabase = createAdminSupabase();
  const insert: TablesInsert<'referral_earnings'> = {
    referrer_id: ref.referrer_id,
    referred_id: input.referredUserId,
    trade_id: input.tradeId,
    amount_lamports: amount,
    paid_out: false,
  };
  const { error } = await supabase.from('referral_earnings').insert(insert);
  if (error) throw new Error(`recordReferralEarningFromTrade: ${error.message}`);
}

export async function listReferralEarningsForUser(
  referrerId: string,
  opts?: { paidOut?: boolean; limit?: number },
): Promise<ReferralEarningRow[]> {
  const supabase = createAdminSupabase();
  const lim = opts?.limit ?? 100;
  const base = () =>
    supabase
      .from('referral_earnings')
      .select('*')
      .eq('referrer_id', referrerId)
      .order('created_at', { ascending: false })
      .limit(lim);

  const { data, error } =
    opts?.paidOut === true
      ? await base().eq('paid_out', true)
      : opts?.paidOut === false
        ? await base().eq('paid_out', false)
        : await base();
  if (error) throw new Error(`listReferralEarningsForUser: ${error.message}`);
  return data ?? [];
}

export async function sumReferralEarningsLamports(referrerId: string): Promise<{
  total: number;
  paid: number;
  pending: number;
}> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('referral_earnings')
    .select('amount_lamports, paid_out')
    .eq('referrer_id', referrerId);
  if (error) throw new Error(`sumReferralEarningsLamports: ${error.message}`);
  let paid = 0;
  let pending = 0;
  for (const r of data ?? []) {
    const n = Number(r.amount_lamports);
    if (!Number.isFinite(n)) continue;
    if (r.paid_out) paid += n;
    else pending += n;
  }
  return { total: paid + pending, paid, pending };
}

export async function markReferralEarningsPaid(input: {
  ids: string[];
  txSignature: string;
}): Promise<void> {
  if (!input.ids.length) return;
  const supabase = createAdminSupabase();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from('referral_earnings')
    .update({
      paid_out: true,
      paid_out_tx_signature: input.txSignature,
      paid_out_at: now,
    })
    .in('id', input.ids)
    .eq('paid_out', false);
  if (error) throw new Error(`markReferralEarningsPaid: ${error.message}`);
}

export async function listUnpaidReferralEarningIds(referrerId: string): Promise<string[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('referral_earnings')
    .select('id')
    .eq('referrer_id', referrerId)
    .eq('paid_out', false);
  if (error) throw new Error(`listUnpaidReferralEarningIds: ${error.message}`);
  return (data ?? []).map((r) => r.id);
}
