import { NextResponse, type NextRequest } from 'next/server';
import { requirePointerUser } from '@/lib/api/privyUser';
import { getCashbackBalanceSol } from '@/lib/db/adminEconomy';
import { cashbackShareBps } from '@/lib/cashback/constants';
import { createAdminSupabase } from '@/lib/supabase/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const HISTORY_LIMIT = 25;

/**
 * The signed-in user's cashback: available balance (canonical
 * `getCashbackBalanceSol` — net of voided rows) + recent ledger entries and the
 * current rebate rate. Read-only view for the app + extension; settlement still
 * flows through the existing claim path.
 */
export async function GET(req: NextRequest) {
  const r = await requirePointerUser(req);
  if ('error' in r) return r.error;

  try {
    const supabase = createAdminSupabase();
    const [balanceSol, ledgerRes] = await Promise.all([
      getCashbackBalanceSol(r.user.id),
      supabase
        .from('cashback_ledger')
        .select('id, amount_sol, kind, reason, status, created_at')
        .eq('user_id', r.user.id)
        .order('created_at', { ascending: false })
        .limit(HISTORY_LIMIT),
    ]);
    if (ledgerRes.error) throw new Error(ledgerRes.error.message);

    const history = (ledgerRes.data ?? []).map((e) => ({
      id: e.id,
      amountSol: Number(e.amount_sol),
      kind: e.kind,
      reason: e.reason,
      status: e.status,
      createdAt: e.created_at,
    }));

    return NextResponse.json({
      balanceSol,
      shareBps: cashbackShareBps(),
      history,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
