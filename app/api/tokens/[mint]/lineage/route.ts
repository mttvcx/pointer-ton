import { NextResponse, type NextRequest } from 'next/server';
import { findSimilarTokensByEmbedding } from '@/lib/db/tokens';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ mint: string }> },
) {
  const { mint } = await ctx.params;
  if (!isValidPublicKey(mint)) {
    return NextResponse.json({ error: 'invalid_mint' }, { status: 400 });
  }

  try {
    const similar = await findSimilarTokensByEmbedding(mint, 12);
    return NextResponse.json({ mint, similar });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'lineage_failed';
    return NextResponse.json({ error: 'lineage_failed', message }, { status: 500 });
  }
}
