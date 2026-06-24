import 'server-only';

import {
  getPackOpenByOpenId,
  getPackPaymentByTx,
  markPackPaymentStatus,
} from '@/lib/db/packs';
import { resolvePackConfig } from '@/lib/packs/packConfig';
import { buildRewardFulfillmentPlan } from '@/lib/packs/rewardFulfillmentPlan';
import { fulfillPackRewards } from '@/lib/packs/fulfillRewards';
import type { Json } from '@/lib/supabase/types';
import type { PackOpenResult, PackType } from '@/types/pack';

/** Give up marking 'failed' only after this many partial attempts. */
const MAX_RESUME_ATTEMPTS = 6;
/** Best-effort lease so a background after() and a client resume don't double-buy. */
const LEASE_MS = 75_000;

export type ResumeOutcome = {
  status: 'fulfilled' | 'pending' | 'failed' | 'not_found' | 'forbidden' | 'unbound' | 'busy';
  delivered: number;
  total: number;
  openId?: string | null;
};

type PaymentMeta = {
  wallet?: string;
  resumeAttempts?: number;
  fulfillingUntil?: number;
  reason?: string;
  fulfillment?: unknown;
};

/**
 * Idempotently drive a paid pack open to full delivery. Safe to call repeatedly
 * (the open route's after(), the client's poll loop, and the reconcile script all
 * use it). Resumable fulfillment skips delivered rewards, recovers
 * bought-but-not-transferred ones, and records each delivery immediately, so a
 * multi-reward pack that can't finish inside one 60s budget completes across calls.
 */
export async function resumePackFulfillment(opts: {
  paymentTx: string;
  /** Authz guard for the user-facing endpoint; omit for admin/reconcile. */
  expectUserId?: string | null;
  /** Admin reconcile: link a payment whose open_id was never bound (killed early). */
  bindOpenId?: string | null;
}): Promise<ResumeOutcome> {
  const payment = await getPackPaymentByTx(opts.paymentTx);
  if (!payment) return { status: 'not_found', delivered: 0, total: 0 };
  if (opts.expectUserId && payment.user_id && payment.user_id !== opts.expectUserId) {
    return { status: 'forbidden', delivered: 0, total: 0 };
  }
  if (payment.status === 'fulfilled') {
    return { status: 'fulfilled', delivered: 0, total: 0, openId: payment.open_id };
  }
  if (payment.status === 'refunded') {
    return { status: 'failed', delivered: 0, total: 0, openId: payment.open_id };
  }

  const meta = (payment.metadata ?? {}) as PaymentMeta;
  const openId = payment.open_id ?? opts.bindOpenId ?? null;
  const userWallet = meta.wallet;
  const userId = payment.user_id;
  if (!openId || !userWallet || !userId) {
    return { status: 'unbound', delivered: 0, total: 0, openId };
  }

  // Best-effort concurrency lease (no atomic CAS in PostgREST; the idempotent
  // fulfillment is the real safety net — this just trims the race window).
  const now = Date.now();
  if ((meta.fulfillingUntil ?? 0) > now) {
    return { status: 'busy', delivered: 0, total: 0, openId };
  }
  try {
    await markPackPaymentStatus({
      id: payment.id,
      status: 'verified',
      openId,
      metadata: { ...meta, fulfillingUntil: now + LEASE_MS } as unknown as Json,
    });
  } catch {
    /* best-effort */
  }

  const open = await getPackOpenByOpenId(openId);
  if (!open) return { status: 'unbound', delivered: 0, total: 0, openId };

  const config = resolvePackConfig(open.pack_type as PackType, Number(open.price_sol));
  const result = open.result as unknown as PackOpenResult;
  const plan = buildRewardFulfillmentPlan(result, { maxPayoutSol: config.maxPayoutSol });

  if (plan.intents.length === 0) {
    await markPackPaymentStatus({ id: payment.id, status: 'fulfilled', openId });
    return { status: 'fulfilled', delivered: 0, total: 0, openId };
  }

  const fulfillment = await fulfillPackRewards({ userWallet, intents: plan.intents, userId, openId });
  const delivered = fulfillment.results.filter((r) => r.ok).length;
  const total = plan.intents.length;

  const baseMeta: PaymentMeta = { ...meta, fulfillingUntil: 0, fulfillment: fulfillment.results };

  if (delivered >= total) {
    await markPackPaymentStatus({
      id: payment.id,
      status: 'fulfilled',
      openId,
      metadata: baseMeta as unknown as Json,
    });
    return { status: 'fulfilled', delivered, total, openId };
  }

  const attempts = (meta.resumeAttempts ?? 0) + 1;
  if (attempts >= MAX_RESUME_ATTEMPTS) {
    await markPackPaymentStatus({
      id: payment.id,
      status: 'failed',
      openId,
      metadata: { ...baseMeta, resumeAttempts: attempts, reason: 'partial_after_max_attempts' } as unknown as Json,
    });
    return { status: 'failed', delivered, total, openId };
  }

  await markPackPaymentStatus({
    id: payment.id,
    status: 'verified',
    openId,
    metadata: { ...baseMeta, resumeAttempts: attempts } as unknown as Json,
  });
  return { status: 'pending', delivered, total, openId };
}
