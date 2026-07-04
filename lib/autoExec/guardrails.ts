import 'server-only';
/* eslint-disable @typescript-eslint/no-explicit-any -- auto_exec_ledger + rpc not in generated types */

import { createAdminSupabase } from '@/lib/supabase/server';
import { isActivityFrozen } from '@/lib/db/accountControls';

/**
 * Guardrail layer for delegated auto-execution. Every check is FAIL-CLOSED: if
 * state can't be read, the answer is "deny", never "allow". The daily-cap +
 * cooldown + per-trade-max reservation is atomic in Postgres (see
 * `reserve_auto_exec`), so concurrent fires can't blow past the cap.
 */

export type ReserveInput = {
  userId: string;
  ruleId: string;
  kind: 'buy' | 'sell';
  mint: string;
  amountSol: number;
  dailyCapSol: number | null;
  perTradeMaxSol: number | null;
  cooldownSeconds: number;
};

export type ReserveResult =
  | { ok: true; ledgerId: string }
  | { ok: false; reason: 'kill_switch' | 'guardrail_read_failed' | 'denied' };

/** Kill switch: a per-account freeze (scope trading|all) halts all firing instantly. Fail-closed. */
export async function isHalted(userId: string): Promise<boolean> {
  try {
    const { frozen } = await isActivityFrozen(userId, 'trading');
    return frozen;
  } catch {
    return true; // can't read freeze state → treat as halted
  }
}

/**
 * Atomically reserve budget for one auto-execution. Returns a ledger id to settle
 * later, or a denial. Does NOT sign anything.
 */
export async function reserveAutoExec(input: ReserveInput): Promise<ReserveResult> {
  if (await isHalted(input.userId)) return { ok: false, reason: 'kill_switch' };

  const db = createAdminSupabase() as any;
  try {
    const { data, error } = await db.rpc('reserve_auto_exec', {
      p_user_id: input.userId,
      p_rule_id: input.ruleId,
      p_kind: input.kind,
      p_mint: input.mint,
      p_amount_sol: input.amountSol,
      p_daily_cap_sol: input.dailyCapSol,
      p_per_trade_max_sol: input.perTradeMaxSol,
      p_cooldown_seconds: input.cooldownSeconds,
    });
    if (error) return { ok: false, reason: 'guardrail_read_failed' };
    if (!data) return { ok: false, reason: 'denied' }; // per-trade max / cooldown / daily cap
    return { ok: true, ledgerId: String(data) };
  } catch {
    return { ok: false, reason: 'guardrail_read_failed' };
  }
}

/** Move a reservation to its terminal state (signed → confirmed/failed, or dry_run). */
export async function settleAutoExec(
  ledgerId: string,
  status: 'signed' | 'confirmed' | 'failed' | 'dry_run',
  extra?: { signature?: string | null; reason?: string | null },
): Promise<void> {
  const db = createAdminSupabase() as any;
  try {
    await db
      .from('auto_exec_ledger')
      .update({
        status,
        signature: extra?.signature ?? null,
        reason: extra?.reason ?? null,
        settled_at: new Date().toISOString(),
      })
      .eq('id', ledgerId);
  } catch {
    /* best-effort — the reservation still counts toward the cap, which is the safe direction */
  }
}
