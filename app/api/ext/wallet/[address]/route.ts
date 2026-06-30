import { NextResponse, type NextRequest } from 'next/server';
import { requireExtAuth } from '@/lib/ext/auth';
import { getWalletStats } from '@/lib/db/wallets';
import { buildSolWalletAnalytics } from '@/lib/wallet-analytics/buildSolAnalytics';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Ext-shaped wallet intelligence — the wallet hover card's data. Reuses the app's
 * `buildSolWalletAnalytics` (net worth, realized/unrealized PnL, win rate) into the
 * `WalletIntel` shape. Behavior type / labels / aliases / recent-trade lists are
 * Phase 3 (kept honest as null/[] rather than invented). Solana only for now.
 */
export async function GET(req: NextRequest, ctx: { params: Promise<{ address: string }> }) {
  const auth = await requireExtAuth(req);
  if ('response' in auth) return auth.response;

  const { address } = await ctx.params;
  if (!address || !isValidPublicKey(address)) {
    return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
  }

  const tfParam = req.nextUrl.searchParams.get('timeframe');
  const timeframe = (['1d', '7d', '30d', 'max'].includes(tfParam ?? '') ? tfParam : '30d') as '1d' | '7d' | '30d' | 'max';

  const stats = await getWalletStats(address).catch(() => null);
  let a: Awaited<ReturnType<typeof buildSolWalletAnalytics>> | null = null;
  try {
    a = await buildSolWalletAnalytics({ address, timeframe, stats });
  } catch {
    return NextResponse.json({ error: 'wallet_unavailable' }, { status: 200 });
  }

  return NextResponse.json({
    address,
    netWorthUsd: a.totalValueUsd ?? null,
    realizedPnlUsd: a.performance?.realizedPnlUsd ?? null,
    unrealizedPnlUsd: a.unrealizedPnlUsd ?? null,
    favoriteEcosystem: a.chain ?? null,
    avgHoldHours: null, // Phase 3
    behavior: null, // Phase 3 (derive from win-rate / tx cadence)
    labels: [], // Phase 3 (identity registry)
    aliases: [],
    recentBuys: [], // Phase 3 (from indexed swaps)
    recentSells: [],
    aiSummary: null, // streamed separately via /api/ext/ai/wallet/[address]
  });
}
