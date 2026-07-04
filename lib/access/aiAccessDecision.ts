/**
 * AI access policy — pure decision logic (no I/O, unit-testable). The I/O wrapper
 * (holdings verification + subscription lookup + caching) lives in `aiAccess.ts`.
 *
 * AI features require ONE of:
 *   (A) linked wallets holding ≥ threshold SOL combined, OR
 *   (B) an active Pointer subscription.
 *
 * Correctness rule that matters most: **never wrongly revoke a paying/eligible
 * user.** When holdings can't be verified (transient RPC failure) we FAIL OPEN
 * within a cached grace window rather than yank access. A confirmed below-
 * threshold (we *did* read the balances) is the only thing that denies on the
 * holdings path.
 */

export type AiAccessBasis = 'subscription' | 'holdings' | 'grace' | 'none';

/** Default combined-SOL threshold for AI access (env-overridable at the I/O layer). */
export const DEFAULT_AI_ACCESS_MIN_SOL = 5;

export interface AiAccessInput {
  hasActiveSubscription: boolean;
  /** Summed native SOL across linked wallets. `null` = could NOT verify (RPC fail). */
  holdingsSol: number | null;
  thresholdSol?: number;
  /** A recent successful grant is cached → keep access during a transient failure. */
  withinGrace?: boolean;
}

export interface AiAccessDecision {
  allowed: boolean;
  basis: AiAccessBasis;
  /** Human-readable "why you do / don't have access". */
  reason: string;
  thresholdSol: number;
  holdingsSol: number | null;
}

const fmtSol = (n: number) => `${n.toFixed(2)} SOL`;

export function decideAiAccess(input: AiAccessInput): AiAccessDecision {
  const thresholdSol = input.thresholdSol ?? DEFAULT_AI_ACCESS_MIN_SOL;
  const holdingsSol = input.holdingsSol;

  // (B) Subscription wins outright.
  if (input.hasActiveSubscription) {
    return {
      allowed: true,
      basis: 'subscription',
      reason: 'Active Pointer subscription.',
      thresholdSol,
      holdingsSol,
    };
  }

  // (A) Verified holdings.
  if (holdingsSol != null) {
    if (holdingsSol >= thresholdSol) {
      return {
        allowed: true,
        basis: 'holdings',
        reason: `Linked wallets hold ${fmtSol(holdingsSol)} (≥ ${fmtSol(thresholdSol)} required).`,
        thresholdSol,
        holdingsSol,
      };
    }
    return {
      allowed: false,
      basis: 'none',
      reason: `Linked wallets hold ${fmtSol(holdingsSol)} — ${fmtSol(thresholdSol)} or a subscription is required.`,
      thresholdSol,
      holdingsSol,
    };
  }

  // Holdings unverifiable (RPC failure). Fail OPEN only within the grace window
  // (a recent successful grant) so a transient outage never revokes a real user.
  if (input.withinGrace) {
    return {
      allowed: true,
      basis: 'grace',
      reason: 'Verifying your holdings — access continues during a brief check.',
      thresholdSol,
      holdingsSol: null,
    };
  }

  return {
    allowed: false,
    basis: 'none',
    reason: 'Could not verify your holdings — link a wallet with ≥ 5 SOL or subscribe.',
    thresholdSol,
    holdingsSol: null,
  };
}

/** Short status line for the "why you have access" UI. */
export function aiAccessHeadline(d: AiAccessDecision): string {
  switch (d.basis) {
    case 'subscription':
      return 'AI unlocked — Pointer subscription';
    case 'holdings':
      return `AI unlocked — ${d.holdingsSol != null ? fmtSol(d.holdingsSol) : 'holdings'} held`;
    case 'grace':
      return 'AI unlocked — verifying holdings';
    default:
      return 'AI locked — hold 5 SOL or subscribe';
  }
}
