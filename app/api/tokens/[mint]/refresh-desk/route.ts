import { NextResponse, type NextRequest } from 'next/server';
import { getLatestSnapshotForMint } from '@/lib/db/tokens';
import { ensureTokenRowFromDas } from '@/lib/helius/feed';
import { getTokenExtendedMetrics } from '@/lib/onchain/tokenMetrics';
import { hydrateQaTokenIfNeeded } from '@/lib/qa/hydrateQaToken';
import { isPointerQaMint } from '@/lib/qa/pointerQaMint';
import { isValidTokenMintParam } from '@/lib/chains/mintKind';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Manual supply / LP / metrics refresh — QA mint uses hydrate pipeline. */
export async function POST(
  _req: NextRequest,
  ctx: { params: Promise<{ mint: string }> },
) {
  const { mint } = await ctx.params;
  if (!isValidTokenMintParam(mint)) {
    return NextResponse.json({ error: 'invalid_mint' }, { status: 400 });
  }

  try {
    const token = await ensureTokenRowFromDas(mint);
    if (!token) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    if (isPointerQaMint(mint)) {
      await hydrateQaTokenIfNeeded(mint, token);
    }

    const [snapshot, { metrics }] = await Promise.all([
      getLatestSnapshotForMint(mint),
      getTokenExtendedMetrics(mint),
    ]);

    return NextResponse.json({
      snapshot,
      metrics,
      refreshedAt: new Date().toISOString(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'refresh_failed';
    return NextResponse.json({ error: 'refresh_failed', message }, { status: 500 });
  }
}
