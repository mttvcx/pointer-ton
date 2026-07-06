import 'server-only';

import type { NextRequest } from 'next/server';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { PLANS } from '@/sibyl/pricing';
import type { PlanTier } from '@/sibyl/types';
import { usageToday } from '@/sibyl/memory/db';

/**
 * Best-effort Privy user id for a Sibyl request. Sibyl is guest-friendly, so this
 * is deliberately fail-open: no/invalid token → null (treated as an anonymous
 * FREE session). Reuses the app's canonical bearer verifier so the DID matches
 * everything else in Pointer.
 */
export async function sibylUserId(req: NextRequest): Promise<string | null> {
  const header = req.headers.get('authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : null;
  if (!token) return null;
  try {
    const { privyId } = await verifyPrivyAccessToken(token);
    return privyId || null;
  } catch {
    return null;
  }
}

/**
 * The plan a Sibyl user is on. Billing isn't live yet, so everyone resolves to
 * FREE for now — but this is the single chokepoint to swap in a real Sibyl
 * subscription lookup (by privyId) the moment Stripe lands. Guests are FREE.
 */
export async function resolveSibylTier(userId: string | null): Promise<PlanTier> {
  if (!userId) return 'FREE';
  // TODO(billing): read the user's Sibyl subscription here → PRO / PRO_PLUS / MAX.
  return 'FREE';
}

export type SibylUsage = {
  tier: PlanTier;
  tokenUsage: string;
  used: number;
  cap: number; // 0 = unlimited (Enterprise/contract)
  remaining: number; // Infinity when uncapped
  overCap: boolean;
  /** Tier we should actually run at — degraded one step when the cap is near. */
  effectiveTier: PlanTier;
  resetAtIso: string; // next 00:00 UTC
};

const DEGRADE_ORDER: PlanTier[] = ['FREE', 'PRO', 'PRO_PLUS', 'MAX', 'ENTERPRISE'];

/** Soft-degrade a tier one notch (used when a user is within the last 10% of their cap). */
function degradeTier(tier: PlanTier): PlanTier {
  const i = DEGRADE_ORDER.indexOf(tier);
  return i > 0 ? DEGRADE_ORDER[i - 1]! : tier;
}

/** Compute a user's live daily-usage picture: how many scans used vs. their cap. */
export async function getSibylUsage(userId: string | null): Promise<SibylUsage> {
  const tier = await resolveSibylTier(userId);
  const cap = PLANS[tier].dailyMessages; // 0 = unlimited
  const used = userId ? await usageToday(userId) : 0;
  const uncapped = cap <= 0;
  const remaining = uncapped ? Infinity : Math.max(0, cap - used);
  const overCap = !uncapped && used >= cap;
  // Within the last 10% of the cap → quietly run one tier lower to protect margin.
  const near = !uncapped && cap > 0 && used / cap >= 0.9;
  const now = new Date();
  const resetAtIso = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  ).toISOString();
  return {
    tier,
    tokenUsage: PLANS[tier].tokenUsage,
    used,
    cap,
    remaining,
    overCap,
    effectiveTier: near ? degradeTier(tier) : tier,
    resetAtIso,
  };
}
