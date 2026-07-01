import { NextResponse, type NextRequest } from 'next/server';
import { requireExtAuth } from '@/lib/ext/auth';
import { isValidPublicKey } from '@/lib/utils/addresses';
import { listAllSwapsForWallet } from '@/lib/db/mintSwaps';
import { realizedFromSwaps } from '@/lib/wallet-analytics/realizedFromSwaps';
import { scheduleWalletIndex } from '@/lib/ingest/indexWalletOnDemand';
import { getTokensByMints } from '@/lib/db/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Fast realized-PnL + curve for a wallet, straight from indexed swaps (no live
 * balances/prices — the heavy /api/ext/wallet path is what's slow). Feeds the
 * avatar ring, hover chart, and portfolio popup.
 *
 * On a miss (wallet not yet indexed), kicks a bounded on-demand backfill and
 * returns `indexing: true`; the client refetches shortly and the data lands.
 */
const WINDOW_MS: Record<string, number> = {
  '1d': 86_400_000,
  '7d': 7 * 86_400_000,
  '30d': 30 * 86_400_000,
};

export async function GET(req: NextRequest, ctx: { params: Promise<{ address: string }> }) {
  const auth = await requireExtAuth(req);
  if ('response' in auth) return auth.response;

  const { address } = await ctx.params;
  if (!address || !isValidPublicKey(address)) {
    return NextResponse.json({ error: 'invalid_address' }, { status: 400 });
  }

  const tf = req.nextUrl.searchParams.get('timeframe') ?? '30d';
  const win = WINDOW_MS[tf]; // undefined → 'max' (all history)
  const sinceIso = win ? new Date(Date.now() - win).toISOString() : undefined;

  const swaps = await listAllSwapsForWallet(address, sinceIso ? { sinceIso } : undefined).catch(() => []);
  if (swaps.length === 0) {
    const indexing = scheduleWalletIndex(address); // bounded background backfill
    return NextResponse.json({ realizedPnlUsd: null, chart: [], topMoves: [], indexing });
  }

  const { realizedPnlUsd, chart, byMint } = realizedFromSwaps(swaps);

  // Top Moves — biggest realized-PnL tokens (FrontRun-style), resolved to symbols.
  const top = byMint
    .filter((m) => Math.abs(m.realizedPnlUsd) >= 1)
    .sort((a, b) => Math.abs(b.realizedPnlUsd) - Math.abs(a.realizedPnlUsd))
    .slice(0, 8);
  const meta = top.length ? await getTokensByMints(top.map((t) => t.mint)).catch(() => new Map()) : new Map();
  const topMoves = top.map((t) => ({
    mint: t.mint,
    symbol: (meta.get(t.mint)?.symbol as string | undefined)?.trim() || t.mint.slice(0, 4),
    pnlUsd: t.realizedPnlUsd,
  }));

  return NextResponse.json({ realizedPnlUsd, chart, topMoves, indexing: false });
}
