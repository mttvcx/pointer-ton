import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import type { Json, Tables, TablesInsert } from '@/lib/supabase/types';

export type PackInventoryRow = Tables<'pack_inventory'>;

/** Missing `pack_inventory` table — pack commerce migration not run yet. */
function isMissingTableError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false;
  if (error.code === '42P01' || error.code === 'PGRST205') return true;
  return /schema cache|find the table|does not exist|relation .* does not exist/i.test(
    error.message ?? '',
  );
}

/** Sum of still-held pack-acquired base units for a mint, as a BigInt. */
export async function getPackHeldRawForMint(userId: string, mint: string): Promise<bigint> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('pack_inventory')
    .select('amount_remaining_raw, status')
    .eq('user_id', userId)
    .eq('mint', mint)
    .neq('status', 'sold');
  if (error) {
    if (isMissingTableError(error)) return 0n;
    throw new Error(`getPackHeldRawForMint: ${error.message}`);
  }
  let sum = 0n;
  for (const r of data ?? []) {
    try {
      sum += BigInt(String(r.amount_remaining_raw).split('.')[0] || '0');
    } catch {
      /* skip malformed */
    }
  }
  return sum;
}

/**
 * Is a sell of `mint` (at least partly) drawn from pack-acquired inventory?
 * Used by the quote/execute fee seams to apply the 2% pack fee + skip cashback.
 * Fails open to `false` so a missing migration never blocks normal trading.
 */
export async function isSellPackOrigin(userId: string, mint: string): Promise<boolean> {
  try {
    return (await getPackHeldRawForMint(userId, mint)) > 0n;
  } catch {
    return false;
  }
}

/** Record tokens credited to a user from a pack open (after on-chain fulfillment). */
export async function recordPackInventory(input: {
  userId: string;
  mint: string;
  openId?: string | null;
  rewardId?: string | null;
  amountRaw: string;
  acquiredTx?: string | null;
  metadata?: Json;
}): Promise<PackInventoryRow> {
  const supabase = createAdminSupabase();
  const insert: TablesInsert<'pack_inventory'> = {
    user_id: input.userId,
    mint: input.mint,
    open_id: input.openId ?? null,
    reward_id: input.rewardId ?? null,
    amount_raw: input.amountRaw,
    amount_remaining_raw: input.amountRaw,
    acquired_tx: input.acquiredTx ?? null,
    status: 'held',
    metadata: input.metadata ?? {},
  };
  const { data, error } = await supabase
    .from('pack_inventory')
    .insert(insert)
    .select('*')
    .single();
  if (error || !data) throw new Error(`recordPackInventory: ${error?.message}`);
  return data;
}

/**
 * Decrement pack inventory for a mint by `soldRaw` base units (FIFO across the
 * user's held rows). Best-effort: returns the amount actually consumed.
 */
export async function consumePackInventory(
  userId: string,
  mint: string,
  soldRaw: string,
): Promise<bigint> {
  let toConsume: bigint;
  try {
    toConsume = BigInt(String(soldRaw).split('.')[0] || '0');
  } catch {
    return 0n;
  }
  if (toConsume <= 0n) return 0n;

  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('pack_inventory')
    .select('id, amount_remaining_raw')
    .eq('user_id', userId)
    .eq('mint', mint)
    .neq('status', 'sold')
    .order('created_at', { ascending: true });
  if (error) {
    if (isMissingTableError(error)) return 0n;
    throw new Error(`consumePackInventory: ${error.message}`);
  }

  let consumed = 0n;
  for (const row of data ?? []) {
    if (toConsume <= 0n) break;
    let remaining: bigint;
    try {
      remaining = BigInt(String(row.amount_remaining_raw).split('.')[0] || '0');
    } catch {
      continue;
    }
    if (remaining <= 0n) continue;
    const take = remaining < toConsume ? remaining : toConsume;
    const nextRemaining = remaining - take;
    const { error: upErr } = await supabase
      .from('pack_inventory')
      .update({
        amount_remaining_raw: nextRemaining.toString(),
        status: nextRemaining <= 0n ? 'sold' : 'partial',
      })
      .eq('id', row.id);
    if (upErr) throw new Error(`consumePackInventory update: ${upErr.message}`);
    consumed += take;
    toConsume -= take;
  }
  return consumed;
}

export async function listPackInventory(userId: string, opts?: { heldOnly?: boolean }): Promise<PackInventoryRow[]> {
  const supabase = createAdminSupabase();
  let q = supabase
    .from('pack_inventory')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (opts?.heldOnly) q = q.neq('status', 'sold');
  const { data, error } = await q;
  if (error) {
    if (isMissingTableError(error)) return [];
    throw new Error(`listPackInventory: ${error.message}`);
  }
  return data ?? [];
}
