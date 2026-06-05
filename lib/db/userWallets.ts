import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import type { Tables, TablesInsert, TablesUpdate } from '@/lib/supabase/types';
import type { UserRow } from '@/lib/db/users';
import { inferMintKind } from '@/lib/chains/mintKind';
import { normalizeWalletAddressForStorage } from '@/lib/wallets/addressNormalize';
import { normalizeTonAddress } from '@/lib/utils/tonAddress';

export type UserWalletRow = Tables<'user_wallets'>;

export async function listUserWallets(userId: string): Promise<UserWalletRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('user_wallets')
    .select('*')
    .eq('user_id', userId)
    .order('is_archived', { ascending: true })
    .order('is_primary', { ascending: false })
    .order('slot', { ascending: true });
  if (error) throw new Error(`listUserWallets failed: ${error.message}`);
  return data ?? [];
}

export async function countUserWallets(userId: string): Promise<number> {
  const supabase = createAdminSupabase();
  const { count, error } = await supabase
    .from('user_wallets')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);
  if (error) throw new Error(`countUserWallets failed: ${error.message}`);
  return count ?? 0;
}

export async function getUserWalletById(
  userId: string,
  id: string,
): Promise<UserWalletRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('user_wallets')
    .select('*')
    .eq('user_id', userId)
    .eq('id', id)
    .maybeSingle();
  if (error) throw new Error(`getUserWalletById failed: ${error.message}`);
  return data;
}

export async function getUserWalletByAddress(
  userId: string,
  walletAddress: string,
): Promise<UserWalletRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('user_wallets')
    .select('*')
    .eq('user_id', userId)
    .eq('wallet_address', walletAddress)
    .maybeSingle();
  if (error) throw new Error(`getUserWalletByAddress failed: ${error.message}`);
  return data;
}

/**
 * If `users.wallet_address` is a real Solana pubkey and no `user_wallets` row
 * exists for it yet, insert one (primary when this is the user's first row).
 */
export async function syncLegacyUserWalletRow(user: UserRow): Promise<void> {
  const legacy =
    user.wallet_address && !user.wallet_address.startsWith('privy:')
      ? user.wallet_address
      : null;
  if (!legacy || !normalizeTonAddress(legacy)) return;

  const existing = await getUserWalletByAddress(user.id, legacy);
  if (existing) return;

  const n = await countUserWallets(user.id);
  await insertUserWallet({
    user_id: user.id,
    wallet_address: legacy,
    label: n === 0 ? 'Primary' : 'Synced',
    is_primary: n === 0,
    slot: n,
    is_archived: false,
    is_active: true,
  });
}

export async function insertUserWallet(
  row: TablesInsert<'user_wallets'>,
): Promise<UserWalletRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase.from('user_wallets').insert(row).select('*').single();
  if (error) throw new Error(`insertUserWallet failed: ${error.message}`);
  return data;
}

export async function updateUserWallet(
  userId: string,
  id: string,
  patch: TablesUpdate<'user_wallets'>,
): Promise<UserWalletRow> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('user_wallets')
    .update(patch)
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`updateUserWallet failed: ${error.message}`);
  return data;
}

/** Clear primary on all rows, then set `id` as primary (single-writer). */
export async function setPrimaryUserWallet(userId: string, id: string): Promise<UserWalletRow> {
  const supabase = createAdminSupabase();
  const { error: e1 } = await supabase
    .from('user_wallets')
    .update({ is_primary: false })
    .eq('user_id', userId);
  if (e1) throw new Error(`setPrimaryUserWallet (clear) failed: ${e1.message}`);
  const { data, error } = await supabase
    .from('user_wallets')
    .update({ is_primary: true })
    .eq('user_id', userId)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(`setPrimaryUserWallet (set) failed: ${error.message}`);
  return data;
}

export async function privyUserOwnsSolanaAddress(
  sessionWalletAddress: string,
  walletAddress: string,
): Promise<boolean> {
  const a = normalizeWalletAddressForStorage(walletAddress);
  const b = normalizeWalletAddressForStorage(sessionWalletAddress);
  return Boolean(a && b && a === b);
}

/** Default portfolio / trading target: primary active row, else first usable, else legacy `users.wallet_address`. */
export async function resolveDefaultWalletAddress(user: UserRow): Promise<string | null> {
  const rows = await listUserWallets(user.id);
  const activeRows = rows.filter((r) => !r.is_archived && r.is_active);
  const primary = activeRows.find((r) => r.is_primary);
  if (primary) return primary.wallet_address;
  if (activeRows[0]) return activeRows[0].wallet_address;

  const legacy =
    user.wallet_address && !user.wallet_address.startsWith('privy:')
      ? user.wallet_address
      : null;
  if (legacy && normalizeTonAddress(legacy)) return legacy;
  return null;
}

/**
 * User may view portfolio / balances for this address (includes imported watch-only rows).
 */
export async function userCanViewWalletPortfolio(
  user: UserRow,
  walletAddress: string,
): Promise<boolean> {
  const normalized = normalizeWalletAddressForStorage(walletAddress);
  if (!normalized) return false;
  const kind = inferMintKind(normalized);
  if (kind !== 'ton' && kind !== 'sol') return false;

  const legacyRaw =
    user.wallet_address && !user.wallet_address.startsWith('privy:')
      ? user.wallet_address
      : null;
  const legacy = legacyRaw ? normalizeWalletAddressForStorage(legacyRaw) : null;
  if (legacy && legacy === normalized) return true;

  const row =
    (await getUserWalletByAddress(user.id, walletAddress)) ??
    (await getUserWalletByAddress(user.id, normalized));
  if (!row) return false;
  if (!row.is_active) return false;
  return true;
}

/**
 * User may swap with this address: legacy profile wallet, or a non-archived active
 * `user_wallets` row that was not imported via Privy importWallet (Phase 4).
 */
export async function userCanUseWalletForTrading(
  user: UserRow,
  walletAddress: string,
): Promise<boolean> {
  const normalized = normalizeWalletAddressForStorage(walletAddress);
  if (!normalized) return false;
  const kind = inferMintKind(normalized);
  if (kind !== 'ton' && kind !== 'sol') return false;

  const legacyRaw =
    user.wallet_address && !user.wallet_address.startsWith('privy:')
      ? user.wallet_address
      : null;
  const legacy = legacyRaw ? normalizeWalletAddressForStorage(legacyRaw) : null;
  if (legacy && legacy === normalized) return true;

  const row =
    (await getUserWalletByAddress(user.id, walletAddress)) ??
    (await getUserWalletByAddress(user.id, normalized));
  if (!row) return false;
  if (row.is_archived) return false;
  if (!row.is_active) return false;
  if (row.is_imported) return false;
  return true;
}

export async function updateUserWalletBalance(
  userId: string,
  id: string,
  lamports: bigint,
): Promise<UserWalletRow> {
  return updateUserWallet(userId, id, {
    balance_lamports: lamports.toString(),
    balance_updated_at: new Date().toISOString(),
  });
}
