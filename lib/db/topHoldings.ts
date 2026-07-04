import 'server-only';
/* eslint-disable @typescript-eslint/no-explicit-any -- wallet_top_holdings not in generated types until the migration is applied */

import { createAdminSupabase } from '@/lib/supabase/server';
import {
  sortTopHolderCredentials,
  tierForRank,
  type TopHolderCredential,
} from '@/lib/walletIdentity/topHolder';

function isMissing(error: { message: string }): boolean {
  return /does not exist|schema cache|42P01/i.test(String(error.message));
}

export interface HolderCaptureRow {
  walletAddress: string;
  rank: number;
  balanceUi?: number | null;
}

/**
 * Capture tap — snapshot the top holders of a mint into the reverse index.
 * Best-effort and fire-and-forget: callers should not await the result on the
 * request path. Only ranks inside the top 100 (a real tier) are stored.
 */
export async function captureTopHolders(
  mint: string,
  symbol: string | null,
  rows: HolderCaptureRow[],
): Promise<void> {
  const eligible = rows
    .filter((r) => r.walletAddress && tierForRank(r.rank) != null)
    .slice(0, 100)
    .map((r) => ({
      wallet_address: r.walletAddress,
      mint,
      symbol: symbol ?? null,
      rank: Math.trunc(r.rank),
      balance_ui: r.balanceUi ?? null,
      captured_at: new Date().toISOString(),
    }));
  if (eligible.length === 0) return;

  const db = createAdminSupabase() as any;
  const { error } = await db
    .from('wallet_top_holdings')
    .upsert(eligible, { onConflict: 'wallet_address,mint' });
  if (error && !isMissing(error)) {
    // Swallow — this is an opportunistic side-effect, never fail the request.
    console.warn('[captureTopHolders] upsert failed:', error.message);
  }
}

/** All top-holder credentials for a single wallet, elite first. */
export async function getTopHoldingsForWallet(
  walletAddress: string,
  limit = 12,
): Promise<TopHolderCredential[]> {
  const db = createAdminSupabase() as any;
  const { data, error } = await db
    .from('wallet_top_holdings')
    .select('mint, symbol, rank, captured_at')
    .eq('wallet_address', walletAddress)
    .order('rank', { ascending: true })
    .limit(limit);
  if (error) {
    if (isMissing(error)) return [];
    throw new Error(error.message);
  }
  const creds = ((data ?? []) as any[])
    .map((r): TopHolderCredential | null => {
      const tier = tierForRank(Number(r.rank));
      if (!tier) return null;
      return {
        mint: String(r.mint),
        symbol: String(r.symbol ?? 'TOKEN'),
        rank: Number(r.rank),
        tier,
        capturedAt: r.captured_at ?? null,
      };
    })
    .filter((x): x is TopHolderCredential => Boolean(x));
  return sortTopHolderCredentials(creds);
}

/** Batch variant for tables/feeds — address → credentials. */
export async function getTopHoldingsForWallets(
  addresses: string[],
): Promise<Record<string, TopHolderCredential[]>> {
  const unique = [...new Set(addresses.filter(Boolean))];
  if (unique.length === 0) return {};
  const db = createAdminSupabase() as any;
  const { data, error } = await db
    .from('wallet_top_holdings')
    .select('wallet_address, mint, symbol, rank')
    .in('wallet_address', unique)
    .order('rank', { ascending: true });
  if (error) {
    if (isMissing(error)) return {};
    throw new Error(error.message);
  }
  const out: Record<string, TopHolderCredential[]> = {};
  for (const r of (data ?? []) as any[]) {
    const tier = tierForRank(Number(r.rank));
    if (!tier) continue;
    const addr = String(r.wallet_address);
    (out[addr] ??= []).push({
      mint: String(r.mint),
      symbol: String(r.symbol ?? 'TOKEN'),
      rank: Number(r.rank),
      tier,
    });
  }
  for (const addr of Object.keys(out)) out[addr] = sortTopHolderCredentials(out[addr]!);
  return out;
}
