import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types';
import type { AppChainId } from '@/lib/chains/appChain';
import { mintMatchesAppChain } from '@/lib/chains/mintKind';

export type TrackedWalletRow = Tables<'tracked_wallets'>;
export type WalletStatsRow = Tables<'wallet_stats'>;
export type DevWalletStatsRow = Tables<'dev_wallet_stats'>;

/* ----------------------------- tracked_wallets ----------------------------- */

export async function listTrackedWalletsForUser(
  userId: string,
): Promise<TrackedWalletRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('tracked_wallets')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(`listTrackedWalletsForUser failed: ${error.message}`);
  return data ?? [];
}

export async function upsertTrackedWallet(
  row: TablesInsert<'tracked_wallets'>,
): Promise<TrackedWalletRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('tracked_wallets')
    .upsert(row, { onConflict: 'user_id,wallet_address' })
    .select('*')
    .single();
  if (error) throw new Error(`upsertTrackedWallet failed: ${error.message}`);
  return data;
}

export async function deleteTrackedWallet(
  userId: string,
  walletAddress: string,
): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('tracked_wallets')
    .delete()
    .eq('user_id', userId)
    .eq('wallet_address', walletAddress);
  if (error) throw new Error(`deleteTrackedWallet failed: ${error.message}`);
}

export async function getTrackedWallet(
  userId: string,
  walletAddress: string,
): Promise<TrackedWalletRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('tracked_wallets')
    .select('*')
    .eq('user_id', userId)
    .eq('wallet_address', walletAddress)
    .maybeSingle();
  if (error) throw new Error(`getTrackedWallet failed: ${error.message}`);
  return data;
}

export async function getTrackedWalletById(
  userId: string,
  id: string,
): Promise<TrackedWalletRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('tracked_wallets')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getTrackedWalletById failed: ${error.message}`);
  return data;
}

/** All users tracking `walletAddress` (for Helius webhook fan-out). */
export async function listUserIdsTrackingWallet(
  walletAddress: string,
): Promise<string[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('tracked_wallets')
    .select('user_id')
    .eq('wallet_address', walletAddress);
  if (error) throw new Error(`listUserIdsTrackingWallet failed: ${error.message}`);
  return [...new Set((data ?? []).map((r) => r.user_id))];
}

export async function deleteAllTrackedWalletsForUser(userId: string): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase.from('tracked_wallets').delete().eq('user_id', userId);
  if (error) throw new Error(`deleteAllTrackedWalletsForUser failed: ${error.message}`);
}

/** Remove only trackers whose address format belongs to the given app chain. */
export async function deleteTrackedWalletsForUserChain(
  userId: string,
  chain: AppChainId,
): Promise<void> {
  const all = await listTrackedWalletsForUser(userId);
  const addrs = all.filter((r) => mintMatchesAppChain(r.wallet_address, chain)).map((r) => r.wallet_address);
  if (addrs.length === 0) return;
  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('tracked_wallets')
    .delete()
    .eq('user_id', userId)
    .in('wallet_address', addrs);
  if (error) throw new Error(`deleteTrackedWalletsForUserChain failed: ${error.message}`);
}

export async function updateTrackedWalletNotify(
  userId: string,
  walletAddress: string,
  notify: boolean,
): Promise<TrackedWalletRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('tracked_wallets')
    .update({ notify })
    .eq('user_id', userId)
    .eq('wallet_address', walletAddress)
    .select('*')
    .single();
  if (error) throw new Error(`updateTrackedWalletNotify failed: ${error.message}`);
  return data;
}

/* ------------------------------- wallet_stats ------------------------------ */

export async function getWalletStats(
  walletAddress: string,
): Promise<WalletStatsRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('wallet_stats')
    .select('*')
    .eq('wallet_address', walletAddress)
    .maybeSingle();
  if (error) throw new Error(`getWalletStats failed: ${error.message}`);
  return data;
}

export async function upsertWalletStats(
  row: TablesInsert<'wallet_stats'>,
): Promise<WalletStatsRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('wallet_stats')
    .upsert(row, { onConflict: 'wallet_address' })
    .select('*')
    .single();
  if (error) throw new Error(`upsertWalletStats failed: ${error.message}`);
  return data;
}

export async function updateWalletStats(
  walletAddress: string,
  patch: TablesUpdate<'wallet_stats'>,
): Promise<WalletStatsRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('wallet_stats')
    .update(patch)
    .eq('wallet_address', walletAddress)
    .select('*')
    .single();
  if (error) throw new Error(`updateWalletStats failed: ${error.message}`);
  return data;
}

/* ---------------------------- dev_wallet_stats ----------------------------- */

export async function getDevWalletStats(
  walletAddress: string,
): Promise<DevWalletStatsRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('dev_wallet_stats')
    .select('*')
    .eq('wallet_address', walletAddress)
    .maybeSingle();
  if (error) throw new Error(`getDevWalletStats failed: ${error.message}`);
  return data;
}

export async function upsertDevWalletStats(
  row: TablesInsert<'dev_wallet_stats'>,
): Promise<DevWalletStatsRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('dev_wallet_stats')
    .upsert(row, { onConflict: 'wallet_address' })
    .select('*')
    .single();
  if (error) throw new Error(`upsertDevWalletStats failed: ${error.message}`);
  return data;
}
