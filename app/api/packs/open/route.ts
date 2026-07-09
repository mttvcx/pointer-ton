import { NextResponse, after, type NextRequest } from 'next/server';
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
import { createFairRng, generateClientSeed, generateServerSeed, hashServerSeed } from '@/lib/packs/provablyFair';
import { reserveRoll } from '@/lib/packs/fairnessSeeds';
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
import { liveCommerceActive } from '@/lib/packs/commerce';
import { verifyPackPayment } from '@/lib/packs/verifyPackPayment';
import { resumePackFulfillment } from '@/lib/packs/resumeFulfillment';
import { solToLamports } from '@/lib/utils/formatters';
import { assertPacksAllowed, EmergencyBlockedError, emergencyBlockedResponse } from '@/lib/emergency/controls';
import { accountFreezeGateOrNull } from '@/lib/trade/accountControlGate';
import type { Json } from '@/lib/supabase/types';
import type { PackOpenResult, PackType } from '@/types/pack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
// Fulfillment (treasury buy + transfer, two on-chain confirmations) runs in an
// `after()` task post-response; keep the function alive long enough to finish.
export const maxDuration = 60;

const PackTypeSchema = z.enum(['bronze', 'silver', 'gold', 'diamond', 'legendary']);

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
  // Emergency packs kill switch / maintenance / read-only — fails closed.
  try {
    await assertPacksAllowed();
  } catch (e) {
    if (e instanceof EmergencyBlockedError) return emergencyBlockedResponse(e);
    throw e;
  }

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

  // Per-user account freeze (fail-closed). Only applies to a known user — an
  // anonymous demo open has no account to freeze and never charges.
  if (userId) {
    const frozen = await accountFreezeGateOrNull(userId, 'trading');
    if (frozen) return frozen;
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

  // Provably-fair roll. An honest roll draws from an HMAC keystream keyed by the
  // user's committed serverSeed + clientSeed + a unique nonce (lib/packs/
  // provablyFair). Reserved lazily so a forced (override/dev) outcome — which
  // does NOT use the RNG — never consumes a nonce. Anonymous opens get an
  // ephemeral seed that is revealed inline.
  let fairness: PackOpenResult['fairness'];
  // Ephemeral seed revealed inline — used for anonymous opens AND as a fail-safe
  // if the per-user seed store (Redis) blips, so a paid open NEVER fails on the
  // fairness layer (the roll stays verifiable, just not pre-committed).
  const ephemeralRoll = (): PackOpenResult => {
    const serverSeed = generateServerSeed();
    const clientSeed = generateClientSeed();
    fairness = { serverSeed, serverSeedHash: hashServerSeed(serverSeed), clientSeed, nonce: 0 };
    return openPackServer(config, createFairRng(serverSeed, clientSeed, 0), openMeta);
  };
  const honestRoll = async (): Promise<PackOpenResult> => {
    if (!userId) return ephemeralRoll();
    try {
      const r = await reserveRoll(userId);
      fairness = { serverSeedHash: r.serverSeedHash, clientSeed: r.clientSeed, nonce: r.nonce };
      return openPackServer(config, createFairRng(r.serverSeed, r.clientSeed, r.nonce), openMeta);
    } catch {
      return ephemeralRoll(); // seed store unavailable — degrade, don't fail the open
    }
  };

  let result = forcedOutcome ? buildForced(forcedOutcome) : await honestRoll();
  if (forcedOutcome) fairness = { forced: true };
  let appliedOverrideId: string | null = null;

  if (activeOverride) {
    const claimed = await consumeOverride(activeOverride.id, result.openId);
    if (claimed) {
      appliedOverrideId = activeOverride.id;
    } else {
      // Lost the claim race (override already consumed elsewhere). Re-roll
      // honestly unless a dev QA mode was also requested.
      activeOverride = null;
      if (devTestMode) {
        result = buildForced(devTestMode);
        fairness = { forced: true };
      } else {
        result = await honestRoll();
      }
    }
  }

  const withPricing = {
    ...result,
    ...openMeta,
    priceSol: config.packPriceSol,
    fairness,
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

  // Live commerce: deliver the won tokens on-chain. Fulfillment is idempotent +
  // resumable (skips delivered rewards, recovers bought-but-not-transferred ones,
  // records each delivery immediately), so a multi-reward pack that can't finish
  // all buys+transfers inside the 60s budget is finished by the client's
  // /api/packs/fulfill-resume call (and a reconcile script can mop up stragglers).
  const fulfillmentPending = live && Boolean(userId) && Boolean(body.userWallet) && Boolean(paymentRowId);
  if (fulfillmentPending) {
    const rowId = paymentRowId as string;
    const openId = finalResult.openId;
    const paymentTx = body.paymentTx as string;

    // Bind the open to the payment SYNCHRONOUSLY so a resume/reconcile can find it
    // even if the after() task is killed before it writes anything.
    try {
      await markPackPaymentStatus({ id: rowId, status: 'verified', openId });
    } catch {
      /* best-effort */
    }

    // Idempotent + resumable delivery (shared with /api/packs/fulfill-resume).
    // A multi-reward pack that can't finish inside 60s is finished by the client's
    // resume calls; partial progress is persisted per reward.
    after(async () => {
      try {
        await resumePackFulfillment({ paymentTx });
      } catch (err) {
        // Leave 'verified' for resume; never mark 'failed' on a transient throw.
        console.error('[packs/open] async fulfillment failed', err);
      }
    });
  }

  return NextResponse.json({
    result: finalResult,
    priceSnapshot: snapshot.packs[body.packType],
    solUsd: quote.solUsd,
    solUsdSource: quote.source,
    economics,
    ledger: live ? 'live' : 'simulated',
    // Delivery is resolved post-response; poll /api/packs/payment-status by the
    // payment signature. null delivered = not yet known (or simulated).
    fulfillmentPending,
    delivered: null,
  });
}
