import { NextResponse, type NextRequest } from 'next/server';
import { listTopHolders } from '@/lib/db/tokens';
import { ensureTokenRowFromDas } from '@/lib/helius/feed';
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
    const token = await ensureTokenRowFromDas(mint);
    if (!token) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const holders = await listTopHolders(mint, 20);
    return NextResponse.json({
      mint,
      decimals: token.decimals,
      holders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'holders_failed';
    return NextResponse.json({ error: 'holders_failed', message }, { status: 500 });
  }
}
