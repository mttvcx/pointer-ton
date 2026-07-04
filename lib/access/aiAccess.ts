import 'server-only';

import { PublicKey } from '@solana/web3.js';
import { getConnection } from '@/lib/solana/connection';
import { heliusCall, HELIUS_CREDITS } from '@/lib/helius/creditLogger';
import { getRedis } from '@/lib/redis/client';
import { listUserWallets } from '@/lib/db/userWallets';
import { isValidPublicKey } from '@/lib/utils/addresses';
import {
  decideAiAccess,
  DEFAULT_AI_ACCESS_MIN_SOL,
  type AiAccessDecision,
} from '@/lib/access/aiAccessDecision';
import { hasActiveSubscription } from '@/lib/access/subscription';

/**
 * AI access I/O — verifies a user's eligibility (≥ N SOL across linked wallets OR
 * an active subscription) and applies the fail-open grace window so a transient
 * RPC outage never wrongly revokes a real user (see `aiAccessDecision.ts`).
 *
 * Enforcement is gated by `AI_ACCESS_ENFORCED` (default OFF) so the gate ships
 * fully built + tested without disrupting the founder beta — flip to `1` to
 * enforce in production. Threshold via `AI_ACCESS_MIN_SOL` (default 5).
 */

const THRESHOLD_SOL = (() => {
  const v = Number(process.env.AI_ACCESS_MIN_SOL);
  return Number.isFinite(v) && v > 0 ? v : DEFAULT_AI_ACCESS_MIN_SOL;
})();
const ENFORCED = process.env.AI_ACCESS_ENFORCED === '1';

const HOLDINGS_TTL_SEC = 10 * 60; // cache the verified sum 10m
const GRACE_TTL_SEC = 6 * 60 * 60; // last successful grant keeps access 6h through an outage

const holdKey = (u: string) => `ai:access:hold:${u}`;
const grantKey = (u: string) => `ai:access:grant:${u}`;

export class AiAccessError extends Error {
  constructor(public decision: AiAccessDecision) {
    super('ai_access_denied');
    this.name = 'AiAccessError';
  }
}

/** Summed native SOL across the user's linked Solana wallets. Returns `null` when
 *  it genuinely couldn't be verified (RPC failure) — the caller fails open within
 *  grace. A cached verified sum short-circuits the RPC. */
async function verifyHoldingsSol(userId: string): Promise<number | null> {
  const redis = getRedis();
  try {
    const cached = await redis.get<string | number>(holdKey(userId));
    if (cached != null) return Number(cached) || 0;
  } catch {
    /* no cache → verify live */
  }

  let addrs: string[];
  try {
    const wallets = await listUserWallets(userId);
    addrs = Array.from(
      new Set(wallets.map((w) => w.wallet_address).filter((a): a is string => !!a && isValidPublicKey(a))),
    );
  } catch {
    return null; // can't even list wallets → unverifiable
  }

  if (addrs.length === 0) {
    try {
      await redis.set(holdKey(userId), '0', { ex: HOLDINGS_TTL_SEC });
    } catch {
      /* best effort */
    }
    return 0; // no Solana wallets linked → verified zero holdings
  }

  const conn = getConnection();
  let lamports = 0;
  try {
    for (const a of addrs) {
      lamports += await heliusCall('getBalance', HELIUS_CREDITS.RPC, () =>
        conn.getBalance(new PublicKey(a), 'confirmed'),
      );
    }
  } catch {
    return null; // RPC failure → unverifiable (caller uses grace)
  }
  const sol = lamports / 1e9;
  try {
    await redis.set(holdKey(userId), String(sol), { ex: HOLDINGS_TTL_SEC });
  } catch {
    /* best effort */
  }
  return sol;
}

async function withinGrace(userId: string): Promise<boolean> {
  try {
    return (await getRedis().get(grantKey(userId))) != null;
  } catch {
    return false;
  }
}
async function markGrant(userId: string): Promise<void> {
  try {
    await getRedis().set(grantKey(userId), '1', { ex: GRACE_TTL_SEC });
  } catch {
    /* best effort */
  }
}

/** Resolve a user's current AI access decision (subscription → holdings → grace). */
export async function getAiAccess(userId: string): Promise<AiAccessDecision> {
  const hasSub = await hasActiveSubscription(userId);
  // Skip the RPC entirely when a subscription already grants access.
  const holdingsSol = hasSub ? null : await verifyHoldingsSol(userId);
  const grace = !hasSub && holdingsSol == null ? await withinGrace(userId) : false;

  const decision = decideAiAccess({
    hasActiveSubscription: hasSub,
    holdingsSol,
    thresholdSol: THRESHOLD_SOL,
    withinGrace: grace,
  });

  // Refresh the grace window on a real (verified) grant so a later outage doesn't revoke.
  if (decision.allowed && decision.basis !== 'grace') void markGrant(userId);
  return decision;
}

/** Throw {@link AiAccessError} when the user may not use AI. No-op unless
 *  `AI_ACCESS_ENFORCED=1`, so the gate is safe to ship before the beta flip. */
export async function assertAiAccess(userId: string): Promise<void> {
  if (!ENFORCED) return;
  const decision = await getAiAccess(userId);
  if (!decision.allowed) throw new AiAccessError(decision);
}

export const aiAccessEnforced = (): boolean => ENFORCED;
