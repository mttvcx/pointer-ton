import 'server-only';

import { reserveAutoExec, settleAutoExec } from '@/lib/autoExec/guardrails';
import { delegatedSignerConfigured, signDelegatedSwap } from '@/lib/autoExec/privySigner';

/**
 * The delegated auto-execution entry point. Order of operations is safety-first
 * and fail-closed:
 *   1. reserveAutoExec — atomic kill-switch + per-trade-max + cooldown + daily-cap.
 *      Denied → nothing happens (logged in the ledger).
 *   2. If the engine isn't explicitly enabled OR no verified signer is configured
 *      → DRY RUN: log 'dry_run', DO NOT sign. This is the default in prod today.
 *   3. Only when enabled AND a reviewed signer exists → sign + broadcast, then
 *      settle the ledger row.
 *
 * `POINTER_AUTO_EXEC_ENABLED=1` is necessary but NOT sufficient — signing also
 * requires `delegatedSignerConfigured()` (unimplemented until security review).
 */

export function autoExecEnabled(): boolean {
  return process.env.POINTER_AUTO_EXEC_ENABLED?.trim() === '1' && delegatedSignerConfigured();
}

export type AutoExecInput = {
  userId: string;
  ruleId: string;
  walletAddress: string;
  mint: string;
  side: 'buy' | 'sell';
  amountSol: number;
  slippageBps: number | null;
  dailyCapSol: number | null;
  perTradeMaxSol: number | null;
  cooldownSeconds: number;
};

export type AutoExecOutcome =
  | { status: 'signed'; signature: string; ledgerId: string }
  | { status: 'dry_run'; ledgerId: string }
  | { status: 'denied'; reason: string }
  | { status: 'failed'; reason: string; ledgerId?: string };

export async function runAutoExecution(input: AutoExecInput): Promise<AutoExecOutcome> {
  // 1) Atomic guardrail reservation (kill switch + per-trade max + cooldown + daily cap).
  const reserved = await reserveAutoExec({
    userId: input.userId,
    ruleId: input.ruleId,
    kind: input.side,
    mint: input.mint,
    amountSol: input.amountSol,
    dailyCapSol: input.dailyCapSol,
    perTradeMaxSol: input.perTradeMaxSol,
    cooldownSeconds: input.cooldownSeconds,
  });
  if (!reserved.ok) return { status: 'denied', reason: reserved.reason };

  // 2) Not enabled / no verified signer → dry run. NEVER signs.
  if (!autoExecEnabled()) {
    await settleAutoExec(reserved.ledgerId, 'dry_run', { reason: 'engine_disabled_or_no_signer' });
    return { status: 'dry_run', ledgerId: reserved.ledgerId };
  }

  // 3) Enabled + reviewed signer present → sign.
  try {
    const { signature } = await signDelegatedSwap({
      userId: input.userId,
      walletAddress: input.walletAddress,
      mint: input.mint,
      amountSol: input.amountSol,
      slippageBps: input.slippageBps,
      side: input.side,
    });
    await settleAutoExec(reserved.ledgerId, 'confirmed', { signature });
    return { status: 'signed', signature, ledgerId: reserved.ledgerId };
  } catch (e) {
    const reason = e instanceof Error ? e.message : 'sign_failed';
    await settleAutoExec(reserved.ledgerId, 'failed', { reason });
    return { status: 'failed', reason, ledgerId: reserved.ledgerId };
  }
}
