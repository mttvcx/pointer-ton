import { NextResponse, type NextRequest } from 'next/server';
import { ensureTokenRowFromDas } from '@/lib/helius/feed';
import { resolveTokenHolders } from '@/lib/onchain/resolveTokenHolders';
import { isValidTokenMintParam } from '@/lib/chains/mintKind';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ mint: string }> },
) {
  const { mint } = await ctx.params;
  if (!isValidTokenMintParam(mint)) {
    return NextResponse.json({ error: 'invalid_mint' }, { status: 400 });
  }

  const forceLive = req.nextUrl.searchParams.get('live') === '1';

  try {
    const token = await ensureTokenRowFromDas(mint);
    if (!token) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const resolved = await resolveTokenHolders(mint, { limit: 20, forceLive });
    if (!resolved) {
      return NextResponse.json({ error: 'holders_unavailable' }, { status: 503 });
    }

    return NextResponse.json({
      mint,
      decimals: resolved.decimals ?? token.decimals,
      holders: resolved.holders,
      holderCount: resolved.holderCount,
      top10HolderPct: resolved.top10HolderPct,
      devHoldingPct: resolved.devHoldingPct,
      source: resolved.source,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'holders_failed';
    return NextResponse.json({ error: 'holders_failed', message }, { status: 500 });
  }
}
