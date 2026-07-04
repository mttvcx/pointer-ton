import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import { isUniqueViolation } from '@/lib/db/pgError';
import { cashbackShareBps } from '@/lib/cashback/constants';
import { isCashbackEnabled } from '@/lib/emergency/controls';
import { lamportsToSol } from '@/lib/utils/formatters';
import type { Json, TablesInsert } from '@/lib/supabase/types';

/**
 * Has a cashback accrual already been recorded for this trade? Cashback rows
 * carry the originating `trade_id` in `metadata`, so a jsonb containment match
 * gives us idempotency without a schema migration (mirrors referral earnings).
 */
async function hasCashbackForTrade(tradeId: string): Promise<boolean> {
  const supabase = createAdminSupabase();
  const { data, error } = await supabase
    .from('cashback_ledger')
    .select('id')
    .eq('kind', 'accrual')
    .contains('metadata', { trade_id: tradeId })
    .limit(1);
  if (error) throw new Error(`hasCashbackForTrade: ${error.message}`);
  return (data ?? []).length > 0;
}

/**
 * Credit the trader with {@link cashbackShareBps} of the platform fee they paid
 * on this trade. Recorded to `cashback_ledger` (settled later via the rewards
 * claim roadmap, same as referral earnings) — never an immediate on-chain payout.
 *
 * No-op when cashback is ineligible (e.g. pack-item sells — the caller gates
 * that), when the fee is zero, or when an accrual already exists for the trade.
 */
export async function recordTradeCashbackAccrual(input: {
  userId: string;
  tradeId: string;
  platformFeeLamports: number;
  signature?: string;
}): Promise<void> {
  // Emergency cashback kill switch — SKIP accrual (never fail the parent trade).
  if (!(await isCashbackEnabled())) return;
  if (!(input.platformFeeLamports > 0)) return;
  const bps = cashbackShareBps();
  if (!(bps > 0)) return;
  if (await hasCashbackForTrade(input.tradeId)) return;

  const amountLamports = Math.floor((input.platformFeeLamports * bps) / 10_000);
  if (!(amountLamports > 0)) return;
  const amountSol = lamportsToSol(amountLamports);

  const metadata: Json = {
    trade_id: input.tradeId,
    signature: input.signature ?? null,
    fee_lamports: input.platformFeeLamports,
    share_bps: bps,
  };
  const insert: TablesInsert<'cashback_ledger'> = {
    user_id: input.userId,
    amount_sol: amountSol,
    kind: 'accrual',
    reason: 'Trade cashback rebate',
    status: 'available',
    metadata,
  };

  const supabase = createAdminSupabase();
  const { error } = await supabase.from('cashback_ledger').insert(insert);
  if (error) {
    // A concurrent writer already recorded this trade's accrual (unique index on
    // metadata->>'trade_id'). Treat as an idempotent no-op — never double-credit.
    if (isUniqueViolation(error)) return;
    throw new Error(`recordTradeCashbackAccrual: ${error.message}`);
  }
}
