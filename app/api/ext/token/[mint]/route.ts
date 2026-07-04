import { NextResponse, type NextRequest } from 'next/server';
import { requireExtAuth } from '@/lib/ext/auth';
import { getTokenByMint, getLatestSnapshotForMint } from '@/lib/db/tokens';
import { fetchUsdPricesForMints } from '@/lib/jupiter/priceTickers';
import { ixBundlers, ixSnipers, ixClusters, insightxConfigured } from '@/lib/insightx/client';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ext-shaped token intelligence — the flagship hover card's data. Wraps the intel
 * Pointer already computes (token row + market snapshot + InsightX bundlers/
 * snipers/clusters) plus a live Jupiter price into the `TokenIntel` shape the
 * extension client expects. Read-only, scoped-token-gated, rate-limited. AI is a
 * separate streaming call — this endpoint never invents a summary.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ mint: string }> }) {
  const auth = await requireExtAuth(req);
  if ('response' in auth) return auth.response;

  const { mint } = await ctx.params;
  if (!mint || !isValidPublicKey(mint)) {
    return NextResponse.json({ error: 'invalid_mint' }, { status: 400 });
  }

  const [token, snapshot, prices] = await Promise.all([
    getTokenByMint(mint).catch(() => null),
    getLatestSnapshotForMint(mint).catch(() => null),
    fetchUsdPricesForMints([mint]).catch(() => null),
  ]);

  // InsightX is key-gated + cost-sensitive — only when configured. Solana mints only
  // for now (EVM chain detection is Phase 3).
  const ix = insightxConfigured()
    ? await Promise.all([
        ixBundlers('sol', mint).catch(() => null),
        ixSnipers('sol', mint).catch(() => null),
        ixClusters('sol', mint).catch(() => null),
      ])
    : [null, null, null];
  const [bundlers, snipers, clusters] = ix;

  const price = prices?.get(mint) ?? null;
  const createdAt = token?.created_at ? new Date(token.created_at).getTime() : null;
  const ageDays = createdAt ? Math.max(0, (Date.now() - createdAt) / 86_400_000) : null;

  const smartMoney =
    clusters?.clusters
      ?.slice(0, 5)
      .map((c, i) => ({ label: c?.tags?.[0] ?? `Cluster ${i + 1}`, pct: c?.pct ?? null })) ?? [];

  return NextResponse.json({
    mint,
    symbol: token?.symbol ?? null,
    name: token?.name ?? null,
    iconUrl: token?.image_url ?? null,
    priceUsd: price?.usdPrice ?? null,
    change24hPct: price?.priceChange24h ?? null,
    marketCapUsd: snapshot?.market_cap_usd ?? null,
    liquidityUsd: snapshot?.liquidity_usd ?? null,
    volume24hUsd: snapshot?.volume_24h_usd ?? null,
    ageDays,
    holderCount: snapshot?.holder_count ?? null,
    top10Pct: snapshot?.top10_holder_pct ?? null,
    bundlersPct: bundlers?.total_bundlers_pct ?? null,
    snipersPct: snipers?.total_snipers_pct ?? null,
    smartMoney,
    creator: {
      wallet: token?.creator_wallet ?? null,
      priorLaunches: null, // Phase 3: deployer history
      rugged: null,
    },
    aiSummary: null, // streamed separately via /api/ext/ai/token/[mint]
  });
}
