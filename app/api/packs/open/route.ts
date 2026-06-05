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
import { PACKS_LIVE_COMMERCE_ENABLED, PACKS_OPEN_USES_SIMULATED_LEDGER } from '@/lib/packs/mode';
import type { PackType } from '@/types/pack';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PackTypeSchema = z.enum(['bronze', 'silver', 'gold', 'legendary']);

const TestCelebrationSchema = z.enum(['jackpot', 'legendary_elite', 'epic_surge']);

const OpenBodySchema = z
  .object({
    packType: PackTypeSchema,
    /** Dev-only — forces celebration QA pulls. */
    testCelebration: TestCelebrationSchema.optional(),
    /** @deprecated use testCelebration: 'jackpot' */
    testJackpot: z.boolean().optional(),
  })
  .strict();

// TODO(compliance): enforce region + age gate before live commerce.
function complianceGate(_userId: string | null): { ok: true } | { ok: false; reason: string } {
  if (PACKS_LIVE_COMMERCE_ENABLED) {
    return { ok: false, reason: 'live_commerce_not_enabled' };
  }
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

  // TODO(fairness): commit-reveal seed + audit log row in Supabase.
  // TODO(commerce): charge primary wallet when PACKS_LIVE_COMMERCE_ENABLED.
  // TODO(commerce): reserve rewardPoolBudget + swap route for token_reward kinds.
  const isDev = process.env.NODE_ENV === 'development';
  const testMode =
    isDev && body.testCelebration
      ? body.testCelebration
      : isDev && body.testJackpot
        ? ('jackpot' as const)
        : null;

  let epicSurgeConfig = config;
  if (
    testMode === 'epic_surge' &&
    (body.packType === 'bronze' || body.packType === 'silver')
  ) {
    epicSurgeConfig = resolvePackConfig('gold', quote.solUsd);
  }

  const result =
    testMode === 'jackpot'
      ? openPackJackpotTest(config)
      : testMode === 'legendary_elite'
        ? openPackLegendaryEliteTest(config)
        : testMode === 'epic_surge'
          ? openPackEpicSurgeTest(epicSurgeConfig)
          : openPackServer(config, Math.random, openMeta);

  const withPricing = {
    ...result,
    ...openMeta,
    priceSol: config.packPriceSol,
  };

  const enriched = await enrichPackRewards(withPricing.rewards, quote.solUsd);
  const finalResult = { ...withPricing, rewards: enriched };

  console.info('[packs/open]', {
    userId,
    simulated: PACKS_OPEN_USES_SIMULATED_LEDGER,
    openId: finalResult.openId,
    packType: finalResult.packType,
    packPriceSol: config.packPriceSol,
    solUsd: quote.solUsd,
    highlight: finalResult.highlightRarity,
    houseEdgeBps: economics.houseEdgeBps,
    totalTokenValueSol: finalResult.totalTokenValueSol,
  });

  return NextResponse.json({
    result: finalResult,
    priceSnapshot: snapshot.packs[body.packType],
    solUsd: quote.solUsd,
    solUsdSource: quote.source,
    economics,
    ledger: PACKS_OPEN_USES_SIMULATED_LEDGER ? 'simulated' : 'live',
  });
}
