import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import type { TokenHolderRow } from '@/lib/db/tokens';

/** Wallets in the holder set matching wallet_stats pro-trader heuristics. */
export async function countProTraders(holders: TokenHolderRow[]): Promise<number> {
  const addrs = holders.map((h) => h.wallet_address).filter(Boolean);
  if (addrs.length === 0) return 0;
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('wallet_stats')
    .select('wallet_address')
    .in('wallet_address', addrs.slice(0, 500))
    .gte('win_rate_30d', 0.6)
    .gte('trades_30d', 20);
  if (error) return 0;
  return data?.length ?? 0;
}
