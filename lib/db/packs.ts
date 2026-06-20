import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import {
  FORCED_OUTCOMES,
  HIGH_VALUE_OUTCOMES,
  outcomeRequiresApproval,
  type ForcedOutcome,
} from '@/lib/packs/overridePolicy';
import type { Json, Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types';

export type PackOpenRow = Tables<'pack_opens'>;
export type PackOverrideRow = Tables<'pack_overrides'>;
export type PackPaymentRow = Tables<'pack_payments'>;

export { FORCED_OUTCOMES, HIGH_VALUE_OUTCOMES, outcomeRequiresApproval };
export type { ForcedOutcome };

/* ------------------------------ history -------------------------------- */

export async function recordPackOpen(input: {
  openId: string;
  userId: string | null;
  packType: string;
  priceSol: number;
  solUsd?: number | null;
  highlightRarity?: string | null;
  totalTokenValueSol?: number | null;
  houseEdgeBps?: number | null;
  isOverride?: boolean;
  overrideId?: string | null;
  simulated?: boolean;
  result: Json;
}): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase.from('pack_opens').insert({
    open_id: input.openId,
    user_id: input.userId,
    pack_type: input.packType,
    price_sol: input.priceSol,
    sol_usd: input.solUsd ?? null,
    highlight_rarity: input.highlightRarity ?? null,
    total_token_value_sol: input.totalTokenValueSol ?? null,
    house_edge_bps: input.houseEdgeBps ?? null,
    is_override: input.isOverride ?? false,
    override_id: input.overrideId ?? null,
    simulated: input.simulated ?? true,
    result: input.result,
  });
  if (error) throw new Error(`recordPackOpen failed: ${error.message}`);
}

export async function listPackOpens(opts: { userId?: string; limit?: number } = {}): Promise<PackOpenRow[]> {
  const supabase = createAdminSupabase();
  let q = supabase.from('pack_opens').select('*').order('created_at', { ascending: false });
  if (opts.userId) q = q.eq('user_id', opts.userId);
  q = q.limit(Math.min(200, Math.max(1, opts.limit ?? 100)));
  const { data, error } = await q;
  if (error) throw new Error(`listPackOpens failed: ${error.message}`);
  return data ?? [];
}

/* ------------------------------ payments ------------------------------- */

/**
 * Claim a pack payment signature exactly once. Returns `{ created: true, row }`
 * on first use and `{ created: false }` if the signature was already recorded
 * (the UNIQUE(payment_tx) constraint is the replay guard).
 */
export async function claimPackPayment(input: {
  paymentTx: string;
  userId: string | null;
  packType: string;
  amountLamports: number;
  metadata?: Json;
}): Promise<{ created: boolean; row?: PackPaymentRow }> {
  const supabase = createAdminSupabase();
  const insert: TablesInsert<'pack_payments'> = {
    payment_tx: input.paymentTx,
    user_id: input.userId,
    pack_type: input.packType,
    amount_lamports: input.amountLamports,
    status: 'verified',
    metadata: input.metadata ?? {},
  };
  const { data, error } = await supabase
    .from('pack_payments')
    .insert(insert)
    .select('*')
    .single();
  if (error) {
    const dup = error.code === '23505' || /duplicate|unique/i.test(error.message);
    if (dup) return { created: false };
    throw new Error(`claimPackPayment: ${error.message}`);
  }
  return { created: true, row: data };
}

export async function markPackPaymentStatus(input: {
  id: string;
  status: 'verified' | 'fulfilled' | 'refunded' | 'failed';
  openId?: string | null;
  metadata?: Json;
}): Promise<void> {
  const supabase = createAdminSupabase();
  const patch: TablesUpdate<'pack_payments'> = { status: input.status };
  if (input.openId !== undefined) patch.open_id = input.openId;
  if (input.metadata !== undefined) patch.metadata = input.metadata;
  const { error } = await supabase.from('pack_payments').update(patch).eq('id', input.id);
  if (error) throw new Error(`markPackPaymentStatus: ${error.message}`);
}

/* ------------------------------ overrides ------------------------------ */

/**
 * Find an approved, unexpired, unconsumed override for a user + pack type.
 * Returns the oldest applicable override (FIFO) so queued promos resolve in
 * order. Pack-type-specific overrides win over wildcard ones.
 */
export async function findActiveOverride(
  userId: string,
  packType: string,
): Promise<PackOverrideRow | null> {
  const supabase = createAdminSupabase();
  const nowIso = new Date().toISOString();
  const { data, error } = await supabase
    .from('pack_overrides')
    .select('*')
    .eq('target_user_id', userId)
    .eq('status', 'approved')
    .is('consumed_open_id', null)
    .gt('expires_at', nowIso)
    .order('created_at', { ascending: true });
  if (error) throw new Error(`findActiveOverride failed: ${error.message}`);
  const rows = (data ?? []).filter((r) => r.pack_type === null || r.pack_type === packType);
  if (rows.length === 0) return null;
  // Prefer a pack-type-specific override over a wildcard one.
  return rows.find((r) => r.pack_type === packType) ?? rows[0]!;
}

export async function consumeOverride(overrideId: string, openId: string): Promise<boolean> {
  const supabase = createAdminSupabase();
  // Conditional update guards against a double-consume race.
  const { data, error } = await supabase
    .from('pack_overrides')
    .update({ status: 'consumed', consumed_open_id: openId, consumed_at: new Date().toISOString() })
    .eq('id', overrideId)
    .eq('status', 'approved')
    .is('consumed_open_id', null)
    .select('id');
  if (error) throw new Error(`consumeOverride failed: ${error.message}`);
  return (data ?? []).length > 0;
}

export async function createOverride(input: {
  targetUserId: string;
  packType: string | null;
  forcedOutcome: ForcedOutcome;
  reason: string;
  expiresAt: string;
  createdByUserId: string | null;
}): Promise<PackOverrideRow> {
  const supabase = createAdminSupabase();
  const requiresApproval = outcomeRequiresApproval(input.forcedOutcome);
  const { data, error } = await supabase
    .from('pack_overrides')
    .insert({
      target_user_id: input.targetUserId,
      pack_type: input.packType,
      forced_outcome: input.forcedOutcome,
      reason: input.reason,
      // Low-value overrides are auto-approved on creation; high-value wait.
      status: requiresApproval ? 'pending' : 'approved',
      requires_approval: requiresApproval,
      created_by: input.createdByUserId,
      expires_at: input.expiresAt,
    })
    .select('*')
    .single();
  if (error || !data) throw new Error(`createOverride failed: ${error?.message}`);
  return data;
}

export async function getOverride(id: string): Promise<PackOverrideRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.from('pack_overrides').select('*').eq('id', id).maybeSingle();
  if (error) throw new Error(`getOverride failed: ${error.message}`);
  return data ?? null;
}

export async function approveOverride(id: string, approverUserId: string): Promise<PackOverrideRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('pack_overrides')
    .update({ status: 'approved', approved_by: approverUserId, approved_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'pending')
    .select('*')
    .single();
  if (error || !data) throw new Error(`approveOverride failed: ${error?.message}`);
  return data;
}

export async function rejectOverride(id: string, reason: string): Promise<PackOverrideRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('pack_overrides')
    .update({ status: 'rejected', rejected_reason: reason })
    .eq('id', id)
    .in('status', ['pending', 'approved'])
    .select('*')
    .single();
  if (error || !data) throw new Error(`rejectOverride failed: ${error?.message}`);
  return data;
}

export async function listOverrides(opts: { status?: string; limit?: number } = {}): Promise<PackOverrideRow[]> {
  const supabase = createAdminSupabase();
  let q = supabase.from('pack_overrides').select('*').order('created_at', { ascending: false });
  if (opts.status) q = q.eq('status', opts.status);
  q = q.limit(Math.min(200, Math.max(1, opts.limit ?? 100)));
  const { data, error } = await q;
  if (error) throw new Error(`listOverrides failed: ${error.message}`);
  return data ?? [];
}
