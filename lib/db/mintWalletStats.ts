import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import { deriveWalletStatsFromSwaps } from '@/lib/indexer/deriveWalletStats';
import { listMintSwapsForMintAsc, listMintSwapsForWallet } from '@/lib/db/mintSwaps';
import { canonicalSolAddress, solAddressesMatch } from '@/lib/solana/canonicalAddress';

export type MintWalletStatsRow = {
  mint: string;
  wallet: string;
  bought_token_raw: number;
  sold_token_raw: number;
  buy_sol: number;
  sell_sol: number;
  buy_usd: number;
  sell_usd: number;
  avg_buy_usd: number | null;
  avg_sell_usd: number | null;
  realized_pnl_usd: number;
  unrealized_pnl_usd: number | null;
  remaining_token_raw: number;
  remaining_token_ui: number;
  first_trade_at: string | null;
  last_trade_at: string | null;
  updated_at: string;
};

export async function upsertMintWalletStats(
  rows: Omit<MintWalletStatsRow, 'updated_at'>[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const supabase = createAdminSupabase();
  const now = new Date().toISOString();
  const payload = rows.map((r) => ({ ...r, updated_at: now }));

  const chunk = 200;
  let written = 0;
  for (let i = 0; i < payload.length; i += chunk) {
    const slice = payload.slice(i, i + chunk);
    const { error } = await supabase.from('mint_wallet_stats').upsert(slice, {
      onConflict: 'mint,wallet',
    });
    if (error) throw new Error(`upsertMintWalletStats failed: ${error.message}`);
    written += slice.length;
  }
  return written;
}

export async function getMintWalletStats(
  mint: string,
  wallet: string,
): Promise<MintWalletStatsRow | null> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('mint_wallet_stats')
    .select('*')
    .eq('mint', mint)
    .eq('wallet', wallet)
    .maybeSingle();
  if (error) throw new Error(`getMintWalletStats failed: ${error.message}`);
  return (data as MintWalletStatsRow | null) ?? null;
}

/** DB row, or derive live from indexed `mint_swaps` when stats table is stale. */
export async function resolveMintWalletStatsForDesk(
  mint: string,
  wallet: string,
  opts?: { currentPriceUsd?: number | null; decimals?: number },
): Promise<MintWalletStatsRow | null> {
  const canon = canonicalSolAddress(wallet);
  if (!canon) return null;

  let stats = await getMintWalletStats(mint, canon);
  if (!stats && wallet.trim() !== canon) {
    stats = await getMintWalletStats(mint, wallet.trim());
  }
  if (stats) return stats;

  let walletSwaps = await listMintSwapsForWallet(mint, canon);
  if (walletSwaps.length === 0 && wallet.trim() !== canon) {
    walletSwaps = await listMintSwapsForWallet(mint, wallet.trim());
  }
  if (walletSwaps.length === 0) {
    const swaps = await listMintSwapsForMintAsc(mint);
    walletSwaps = swaps.filter((s) => solAddressesMatch(s.wallet, canon));
  }
  if (walletSwaps.length === 0) return null;

  const derived = deriveWalletStatsFromSwaps(walletSwaps, opts);
  return derived.find((r) => solAddressesMatch(r.wallet, canon)) ?? derived[0] ?? null;
}

export async function listMintWalletStatsForMint(
  mint: string,
  limit: number,
): Promise<MintWalletStatsRow[]> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('mint_wallet_stats')
    .select('*')
    .eq('mint', mint)
    .order('realized_pnl_usd', { ascending: false })
    .limit(limit);
  if (error) throw new Error(`listMintWalletStatsForMint failed: ${error.message}`);
  return (data ?? []) as MintWalletStatsRow[];
}

export async function countMintWalletStats(mint: string): Promise<number> {
  const supabase = createAdminSupabase();
  const { count, error } = await supabase
    .from('mint_wallet_stats')
    .select('wallet', { count: 'exact', head: true })
    .eq('mint', mint);
  if (error) throw new Error(`countMintWalletStats failed: ${error.message}`);
  return count ?? 0;
}

export async function listMintWalletStatsByWallets(
  mint: string,
  wallets: string[],
): Promise<Map<string, MintWalletStatsRow>> {
  const map = new Map<string, MintWalletStatsRow>();
  if (wallets.length === 0) return map;
  const supabase = createAdminSupabase();
  const chunk = 200;
  for (let i = 0; i < wallets.length; i += chunk) {
    const slice = wallets.slice(i, i + chunk);
    const { data, error } = await supabase
      .from('mint_wallet_stats')
      .select('*')
      .eq('mint', mint)
      .in('wallet', slice);
    if (error) throw new Error(`listMintWalletStatsByWallets failed: ${error.message}`);
    for (const row of (data ?? []) as MintWalletStatsRow[]) {
      map.set(row.wallet, row);
    }
  }
  return map;
}
