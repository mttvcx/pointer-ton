import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import type { Tables, TablesInsert } from '@/lib/supabase/types';

export type WalletLabelRow = Tables<'wallet_labels'>;

export async function upsertWalletLabel(
  userId: string,
  walletAddress: string,
  label: string,
  emoji: string | null,
  color: string,
): Promise<WalletLabelRow> {
  const supabase = createAdminSupabase();
  const row: TablesInsert<'wallet_labels'> = {
    user_id: userId,
    wallet_address: walletAddress,
    label: label.trim(),
    emoji: emoji?.trim() || null,
    color: color || 'yellow',
  };
  const { data, error } = await supabase
    .from('wallet_labels')
    .upsert(row, { onConflict: 'user_id,wallet_address' })
    .select('*')
    .single();

  if (error) throw new Error(`upsertWalletLabel failed: ${error.message}`);
  return data;
}

export async function listWalletLabelsForUser(userId: string): Promise<WalletLabelRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('wallet_labels')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(`listWalletLabelsForUser failed: ${error.message}`);
  return data ?? [];
}

/** Map wallet_address ? row for fast lookups. */
export async function getWalletLabelsForUser(
  userId: string,
): Promise<Record<string, WalletLabelRow>> {
  const rows = await listWalletLabelsForUser(userId);
  const out: Record<string, WalletLabelRow> = {};
  for (const r of rows) {
    out[r.wallet_address] = r;
  }
  return out;
}

export async function getWalletLabel(
  userId: string,
  walletAddress: string,
): Promise<WalletLabelRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('wallet_labels')
    .select('*')
    .eq('user_id', userId)
    .eq('wallet_address', walletAddress)
    .maybeSingle();

  if (error) throw new Error(`getWalletLabel failed: ${error.message}`);
  return data;
}

export async function deleteWalletLabel(userId: string, walletAddress: string): Promise<void> {
  const supabase = createAdminSupabase();
  const { error } = await supabase
    .from('wallet_labels')
    .delete()
    .eq('user_id', userId)
    .eq('wallet_address', walletAddress);

  if (error) throw new Error(`deleteWalletLabel failed: ${error.message}`);
}
