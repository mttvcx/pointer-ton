import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { getUserByPrivyId } from '@/lib/db/users';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import {
  openPackEpicSurgeTest,
  openPackJackpotTest,
  openPackLegendaryEliteTest,
  openPackServer,
} from '@/lib/packs/openPack';
import { enrichPackRewards } from '@/lib/packs/enrichRewards';
import {
  computePackEconomics,
  resolvePackConfig,
  resolvePackConfigAtMarket,
} from '@/lib/packs/packConfig';
import { approximateUsdFromSol } from '@/lib/packs/pricing';
import {
  findActiveOverride,
  consumeOverride,
  recordPackOpen,
  claimPackPayment,
  markPackPaymentStatus,
  type ForcedOutcome,
} from '@/lib/db/packs';
import { recordPackInventory } from '@/lib/db/packInventory';
import { liveCommerceActive } from '@/lib/packs/commerce';
import { verifyPackPayment } from '@/lib/packs/verifyPackPayment';
import { buildRewardFulfillmentPlan } from '@/lib/packs/rewardFulfillmentPlan';
import { fulfillPackRewards } from '@/lib/packs/fulfillRewards';
import { solToLamports } from '@/lib/utils/formatters';
import type { Json } from '@/lib/supabase/types';
import type { PackType } from '@/types/pack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PackTypeSchema = z.enum(['bronze', 'silver', 'gold', 'legendary']);

const TestCelebrationSchema = z.enum(['jackpot', 'legendary_elite', 'epic_surge']);

const OpenBodySchema = z
  .object({
    packType: PackTypeSchema,
    /** Live commerce: the SOL-transfer signature paying the pack price to treasury. */
    paymentTx: z.string().min(64).max(128).optional(),
    /** Live commerce: the wallet that signed the payment (also receives winnings). */
    userWallet: z.string().min(32).max(64).optional(),
    /** Dev-only — forces celebration QA pulls. */
    testCelebration: TestCelebrationSchema.optional(),
    /** @deprecated use testCelebration: 'jackpot' */
    testJackpot: z.boolean().optional(),
  })
  .strict();

// TODO(compliance): enforce region + age gate before live commerce ships broadly.
function complianceGate(_userId: string | null): { ok: true } | { ok: false; reason: string } {
  return { ok: true };
}

// TODO(compliance): daily spend limits + cooldown tracking per user.
function responsibleLimitsGate(_userId: string | null): { ok: true } {
  return { ok: true };
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;

  let userId: string | null = null;
  if (accessToken) {
    try {
      const verified = await verifyPrivyAccessToken(accessToken);
      const user = await getUserByPrivyId(verified.privyId);
      userId = user?.id ?? null;
    } catch {
      /* allow anonymous demo opens */
    }
  }

  const compliance = complianceGate(userId);
  if (!compliance.ok) {
    return NextResponse.json({ error: compliance.reason }, { status: 403 });
  }

  const limits = responsibleLimitsGate(userId);
  if (!limits.ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  let body: z.infer<typeof OpenBodySchema>;
  try {
    const json: unknown = await req.json();
    body = OpenBodySchema.parse(json);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  let resolved: Awaited<ReturnType<typeof resolvePackConfigAtMarket>>;
  try {
    resolved = await resolvePackConfigAtMarket(body.packType as PackType);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'pack_invalid';
    return NextResponse.json({ error: 'pack_invalid', message }, { status: 400 });
  }

  const { config, quote, snapshot } = resolved;
  const economics = computePackEconomics(config);
  if (!economics.valid) {
    return NextResponse.json(
      { error: 'pack_economics_invalid', errors: economics.errors },
      { status: 500 },
    );
  }

  const openMeta = {
    solUsd: quote.solUsd,
    solUsdSource: quote.source,
    approximateUsd: approximateUsdFromSol(config.packPriceSol, quote.solUsd),
    modeledHouseEdgeBps: economics.houseEdgeBps,
    fullOpenEvSol: economics.fullOpenEvSol,
  };

  // Live commerce: charge the user before rolling. Requires an authenticated
  // user, the paying wallet, and a verified, single-use on-chain payment of the
  // pack price to the treasury. A failed/absent payment never rolls a pack.
  const live = liveCommerceActive();
  let paymentRowId: string | null = null;
  if (live) {
    if (!userId) {
      return NextResponse.json({ error: 'auth_required' }, { status: 401 });
    }
    if (!body.paymentTx || !body.userWallet) {
      return NextResponse.json({ error: 'payment_required' }, { status: 402 });
    }
    const expectedLamports = Number(solToLamports(config.packPriceSol));
    const verify = await verifyPackPayment({
      signature: body.paymentTx,
      payer: body.userWallet,
      expectedLamports,
    });
    if (!verify.ok) {
      return NextResponse.json(
        { error: 'payment_unverified', reason: verify.reason },
        { status: 402 },
      );
    }
    const claim = await claimPackPayment({
      paymentTx: body.paymentTx,
      userId,
      packType: body.packType,
      amountLamports: verify.creditedLamports,
      metadata: { wallet: body.userWallet },
    });
    if (!claim.created) {
      return NextResponse.json({ error: 'payment_already_used' }, { status: 409 });
    }
    paymentRowId = claim.row?.id ?? null;
  }

  const isDev = process.env.NODE_ENV === 'development';
  const devTestMode: ForcedOutcome | null =
    isDev && body.testCelebration
      ? body.testCelebration
      : isDev && body.testJackpot
        ? ('jackpot' as const)
        : null;

  // Admin-issued override (real promo) takes precedence over dev QA modes and
  // the RNG. We claim the override atomically *after* computing the forced
  // result; if the claim loses a race we fall back to a normal roll so the
  // outcome is never granted twice.
  let activeOverride = userId ? await findActiveOverride(userId, body.packType) : null;
  const forcedOutcome: ForcedOutcome | null =
    (activeOverride?.forced_outcome as ForcedOutcome | undefined) ?? devTestMode;

  let epicSurgeConfig = config;
  if (
    forcedOutcome === 'epic_surge' &&
    (body.packType === 'bronze' || body.packType === 'silver')
  ) {
    epicSurgeConfig = resolvePackConfig('gold', quote.solUsd);
  }

  const buildForced = (mode: ForcedOutcome) =>
    mode === 'jackpot'
      ? openPackJackpotTest(config)
      : mode === 'legendary_elite'
        ? openPackLegendaryEliteTest(config)
        : openPackEpicSurgeTest(epicSurgeConfig);

  let result = forcedOutcome ? buildForced(forcedOutcome) : openPackServer(config, Math.random, openMeta);
  let appliedOverrideId: string | null = null;

  if (activeOverride) {
    const claimed = await consumeOverride(activeOverride.id, result.openId);
    if (claimed) {
      appliedOverrideId = activeOverride.id;
    } else {
      // Lost the claim race (override already consumed elsewhere). Re-roll
      // honestly unless a dev QA mode was also requested.
      activeOverride = null;
      result = devTestMode ? buildForced(devTestMode) : openPackServer(config, Math.random, openMeta);
    }
  }

  const withPricing = {
    ...result,
    ...openMeta,
    priceSol: config.packPriceSol,
  };

  const enriched = await enrichPackRewards(withPricing.rewards, quote.solUsd);
  const finalResult = { ...withPricing, rewards: enriched };

  // Persist every open (replaces the old console-only TODO). Fail-soft: a
  // history write failure must not break the user's open.
  try {
    await recordPackOpen({
      openId: finalResult.openId,
      userId,
      packType: finalResult.packType,
      priceSol: config.packPriceSol,
      solUsd: quote.solUsd,
      highlightRarity: finalResult.highlightRarity,
      totalTokenValueSol: finalResult.totalTokenValueSol,
      houseEdgeBps: economics.houseEdgeBps,
      isOverride: Boolean(appliedOverrideId),
      overrideId: appliedOverrideId,
      simulated: !live,
      result: finalResult as unknown as Json,
    });
  } catch (err) {
    console.error('[packs/open] history write failed', err);
  }

  // Live commerce: deliver the won tokens on-chain (treasury buys + transfers),
  // then record them as pack inventory so SELLING charges 2% and earns no
  // cashback. Per-reward failures are isolated and reported for reconciliation.
  let fulfillment: Awaited<ReturnType<typeof fulfillPackRewards>> | null = null;
  if (live && userId && body.userWallet) {
    const plan = buildRewardFulfillmentPlan(finalResult, { maxPayoutSol: config.maxPayoutSol });
    fulfillment = await fulfillPackRewards({ userWallet: body.userWallet, intents: plan.intents });
    for (const r of fulfillment.results) {
      if (r.ok && r.deliveredRaw) {
        try {
          await recordPackInventory({
            userId,
            mint: r.mint,
            openId: finalResult.openId,
            rewardId: r.rewardId,
            amountRaw: r.deliveredRaw,
            acquiredTx: r.transferTx ?? r.buyTx ?? null,
          });
        } catch (err) {
          console.error('[packs/open] inventory write failed', err);
        }
      }
    }
    // Only mark fulfilled if at least one reward actually delivered. Otherwise
    // the buyer paid but received nothing — mark FAILED (not fulfilled) so it is
    // visible for refund/reconciliation instead of silently looking complete.
    const anyDelivered = fulfillment.results.some((r) => r.ok && r.deliveredRaw);
    if (paymentRowId) {
      try {
        await markPackPaymentStatus({
          id: paymentRowId,
          status: anyDelivered ? 'fulfilled' : 'failed',
          openId: finalResult.openId,
          metadata: anyDelivered ? undefined : { reason: 'fulfillment_delivered_nothing' },
        });
      } catch {
        /* best-effort */
      }
    }
  }

  const delivered =
    fulfillment != null ? fulfillment.results.some((r) => r.ok && r.deliveredRaw) : null;

  return NextResponse.json({
    result: finalResult,
    priceSnapshot: snapshot.packs[body.packType],
    solUsd: quote.solUsd,
    solUsdSource: quote.source,
    economics,
    ledger: live ? 'live' : 'simulated',
    fulfillment: fulfillment?.results ?? null,
    // null = simulated; true = delivered; false = paid but delivery failed
    // (payment marked 'failed' for refund — client should show an honest message).
    delivered,
  });
}
