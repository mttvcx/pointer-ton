import { NextResponse, type NextRequest } from 'next/server';
import { requireExtAuth } from '@/lib/ext/auth';
import { getTokenByMint, getLatestSnapshotForMint } from '@/lib/db/tokens';
import { fetchUsdPricesForMints } from '@/lib/jupiter/priceTickers';
import { ixBundlers, ixSnipers, ixClusters, insightxConfigured } from '@/lib/insightx/client';
import { isValidPublicKey } from '@/lib/utils/addresses';
import { dexscreenerToken } from '@/lib/ext/dexscreener';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const EVM_RE = /^0x[a-fA-F0-9]{40}$/;

/** Empty TokenIntel skeleton (client degrades gracefully on nulls). */
function empty(mint: string, chain: string) {
  return {
    mint,
    chain,
    symbol: null,
    name: null,
    iconUrl: null,
    priceUsd: null,
    change24hPct: null,
    marketCapUsd: null,
    liquidityUsd: null,
    volume24hUsd: null,
    ageDays: null,
    holderCount: null,
    top10Pct: null,
    bundlersPct: null,
    snipersPct: null,
    smartMoney: [] as { label: string; pct: number | null }[],
    creator: { wallet: null as string | null, priorLaunches: null, rugged: null },
    aiSummary: null,
  };
}

/**
 * Ext-shaped token intelligence — the flagship hover card's data. Chain-agnostic:
 * Solana mints use Pointer's own intel (token row + snapshot + InsightX) with a
 * DexScreener fallback for market fields; EVM tokens come from DexScreener. When an
 * address has no market anywhere it's a WALLET, not a token — we return
 * `{ notToken: true }` so the extension shows a wallet card instead. Read-only,
 * scoped-token-gated. AI is a separate streaming call.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ mint: string }> }) {
  const auth = await requireExtAuth(req);
  if ('response' in auth) return auth.response;

  const { mint } = await ctx.params;
  const isEvm = EVM_RE.test(mint);
  const isSol = !isEvm && isValidPublicKey(mint);
  if (!mint || (!isEvm && !isSol)) {
    return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
  }

  // ---- EVM: DexScreener is the source of truth (cross-chain) ----
  if (isEvm) {
    const dex = await dexscreenerToken(mint);
    if (!dex) return NextResponse.json({ notToken: true, chain: 'evm', mint });
    return NextResponse.json({
      ...empty(mint, dex.chain),
      symbol: dex.symbol,
      name: dex.name,
      iconUrl: dex.iconUrl,
      priceUsd: dex.priceUsd,
      change24hPct: dex.change24hPct,
      marketCapUsd: dex.marketCapUsd,
      liquidityUsd: dex.liquidityUsd,
      volume24hUsd: dex.volume24hUsd,
      ageDays: dex.ageDays,
      pairUrl: dex.pairUrl,
    });
  }

  // ---- Solana: Pointer's own intel, DexScreener fills the gaps ----
  const [token, snapshot, prices] = await Promise.all([
    getTokenByMint(mint).catch(() => null),
    getLatestSnapshotForMint(mint).catch(() => null),
    fetchUsdPricesForMints([mint]).catch(() => null),
  ]);
  const price = prices?.get(mint) ?? null;

  // Nothing on-chain here yet? Confirm token-vs-wallet with DexScreener. A mint
  // has pairs; a wallet doesn't — that's how we stop rendering wallets as tokens.
  const thin = !token && !snapshot && !price?.usdPrice;
  const dex = thin || !snapshot?.market_cap_usd ? await dexscreenerToken(mint, 'solana').catch(() => null) : null;
  if (thin && !dex) {
    return NextResponse.json({ notToken: true, chain: 'solana', mint });
  }

  const ix = insightxConfigured()
    ? await Promise.all([
        ixBundlers('sol', mint).catch(() => null),
        ixSnipers('sol', mint).catch(() => null),
        ixClusters('sol', mint).catch(() => null),
      ])
    : [null, null, null];
  const [bundlers, snipers, clusters] = ix;

  const createdAt = token?.created_at ? new Date(token.created_at).getTime() : null;
  const ageDays = createdAt ? Math.max(0, (Date.now() - createdAt) / 86_400_000) : dex?.ageDays ?? null;

  const smartMoney =
    clusters?.clusters
      ?.slice(0, 5)
      .map((c, i) => ({ label: c?.tags?.[0] ?? `Cluster ${i + 1}`, pct: c?.pct ?? null })) ?? [];

  return NextResponse.json({
    mint,
    chain: 'solana',
    symbol: token?.symbol ?? dex?.symbol ?? null,
    name: token?.name ?? dex?.name ?? null,
    iconUrl: token?.image_url ?? dex?.iconUrl ?? null,
    priceUsd: price?.usdPrice ?? dex?.priceUsd ?? null,
    change24hPct: price?.priceChange24h ?? dex?.change24hPct ?? null,
    marketCapUsd: snapshot?.market_cap_usd ?? dex?.marketCapUsd ?? null,
    liquidityUsd: snapshot?.liquidity_usd ?? dex?.liquidityUsd ?? null,
    volume24hUsd: snapshot?.volume_24h_usd ?? dex?.volume24hUsd ?? null,
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
