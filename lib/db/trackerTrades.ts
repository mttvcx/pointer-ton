import 'server-only';
import { createAdminSupabase } from '@/lib/supabase/server';
import { listTrackedWalletsForUser } from '@/lib/db/wallets';

/**
 * Live-trades feed for the wallet tracker. Reads REAL parsed swaps from
 * `mint_swaps` for the wallets THIS user tracks — a cheap DB read, no Helius
 * fan-out. Symbol/image are joined from `tokens` when we know the mint (most
 * KOL-traded tokens aren't in our Pulse `tokens` set, so we fall back to the
 * mint). market_cap_usd is almost never present on swaps, so the UI omits it.
 */
export type TrackerTradeRow = {
  signature: string;
  wallet: string;
  walletLabel: string | null;
  mint: string;
  symbol: string | null;
  name: string | null;
  imageUrl: string | null;
  side: 'buy' | 'sell';
  solAmount: number | null;
  usdAmount: number | null;
  marketCapUsd: number | null;
  blockTime: string | null;
};

const num = (v: unknown): number | null =>
  v == null || Number.isNaN(Number(v)) ? null : Number(v);

export async function listTrackedWalletTradesForUser(
  userId: string,
  limit = 40,
): Promise<TrackerTradeRow[]> {
  const tracked = await listTrackedWalletsForUser(userId);
  if (tracked.length === 0) return [];

  const labelByAddr = new Map<string, string | null>(
    tracked.map((t) => [t.wallet_address, t.label ?? null]),
  );
  const addrs = tracked.map((t) => t.wallet_address);

  const supabase = createAdminSupabase();
  // Over-fetch so the signature+side dedupe still leaves us `limit` rows.
  const { data, error } = await supabase
    .from('mint_swaps')
    .select('signature, wallet, mint, side, sol_amount, usd_amount, market_cap_usd, block_time')
    .in('wallet', addrs)
    .order('block_time', { ascending: false, nullsFirst: false })
    .limit(limit * 4);
  if (error) throw new Error(`listTrackedWalletTradesForUser failed: ${error.message}`);

  const seen = new Set<string>();
  const deduped: NonNullable<typeof data> = [];
  for (const r of data ?? []) {
    const key = `${r.signature}:${r.side}:${r.wallet}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(r);
    if (deduped.length >= limit) break;
  }

  const mints = [...new Set(deduped.map((r) => r.mint))];
  const tokenByMint = new Map<
    string,
    { symbol: string | null; name: string | null; image_url: string | null }
  >();
  if (mints.length) {
    const { data: toks } = await supabase
      .from('tokens')
      .select('mint, symbol, name, image_url')
      .in('mint', mints);
    for (const t of toks ?? [])
      tokenByMint.set(t.mint, { symbol: t.symbol, name: t.name, image_url: t.image_url });
  }

  return deduped.map((r) => {
    const tok = tokenByMint.get(r.mint);
    return {
      signature: r.signature,
      wallet: r.wallet,
      walletLabel: labelByAddr.get(r.wallet) ?? null,
      mint: r.mint,
      symbol: tok?.symbol ?? null,
      name: tok?.name ?? null,
      imageUrl: tok?.image_url ?? null,
      side: r.side === 'sell' ? 'sell' : 'buy',
      solAmount: num(r.sol_amount),
      usdAmount: num(r.usd_amount),
      marketCapUsd: num(r.market_cap_usd),
      blockTime: r.block_time,
    };
  });
}
