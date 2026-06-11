import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import type { TokenHolderRow } from '@/lib/db/tokens';

/**
 * Wallets in the holder set matching wallet_stats pro-trader heuristics.
 *
 * Honest-null semantics: `null` = no `wallet_stats` coverage for any of these
 * wallets (metric unavailable, render `—`); `0`+ = real count from indexed
 * stats. Never report a green `0` when the stats table simply has no data.
 */
export async function countProTraders(holders: TokenHolderRow[]): Promise<number | null> {
  const addrs = holders.map((h) => h.wallet_address).filter(Boolean);
  if (addrs.length === 0) return null;
  const supabase = createAdminSupabase();

  const { data: covered, error: coverageErr } = await supabase
    .from('wallet_stats')
    .select('wallet_address')
    .in('wallet_address', addrs.slice(0, 500))
    .limit(1);
  if (coverageErr) return null;
  if (!covered || covered.length === 0) return null;

  const { data, error } = await supabase
    .from('wallet_stats')
    .select('wallet_address')
    .in('wallet_address', addrs.slice(0, 500))
    .gte('win_rate_30d', 0.6)
    .gte('trades_30d', 20);
  if (error) return null;
  return data?.length ?? 0;
}
