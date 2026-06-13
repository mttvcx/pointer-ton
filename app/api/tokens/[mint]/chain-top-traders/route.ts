import { NextResponse, type NextRequest } from 'next/server';
import { listMintSwapsForMintAsc } from '@/lib/db/mintSwaps';
import { buildChainTopTradersFromSwaps } from '@/lib/indexer/chainTopTraders';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Top traders ranked from indexed chain swaps (FIFO realized PnL) for any
 * mint with mint_swaps rows. Returns 200 with empty `traders` and
 * `label: 'indexer_pending'` when no rows exist.
 */
export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ mint: string }> },
) {
  const { mint } = await ctx.params;
  if (!isValidPublicKey(mint)) {
    return NextResponse.json({ error: 'invalid_mint' }, { status: 400 });
  }

  const limit = Math.min(50, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 25));
  try {
    const swaps = await listMintSwapsForMintAsc(mint);
    if (swaps.length === 0) {
      return NextResponse.json({
        traders: [],
        source: 'chain_indexer',
        label: 'indexer_pending',
        message: 'No indexed chain trades yet for this mint.',
      });
    }
    const traders = buildChainTopTradersFromSwaps(swaps, limit);
    return NextResponse.json({
      traders,
      source: 'chain_indexer',
      label: 'Indexed chain trades',
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
