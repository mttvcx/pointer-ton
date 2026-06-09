import { NextResponse, type NextRequest } from 'next/server';
import { listMintSwapsForMint } from '@/lib/db/mintSwaps';
import { mintSwapToDeskTrade } from '@/lib/indexer/chainTradeAdapter';
import { isPointerQaMint } from '@/lib/qa/pointerQaMint';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Indexed chain swaps for QA mint desk tape. */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ mint: string }> },
) {
  const { mint } = await ctx.params;
  if (!isValidPublicKey(mint)) {
    return NextResponse.json({ error: 'invalid_mint' }, { status: 400 });
  }
  if (!isPointerQaMint(mint)) {
    return NextResponse.json({ error: 'qa_mint_only' }, { status: 403 });
  }

  const limit = Math.min(200, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 80));
  try {
    const swaps = await listMintSwapsForMint(mint, limit);
    const trades = swaps.map(mintSwapToDeskTrade).filter((t): t is NonNullable<typeof t> => t != null);
    return NextResponse.json({
      trades,
      source: 'chain_indexer',
      label: 'Indexed chain trades',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
