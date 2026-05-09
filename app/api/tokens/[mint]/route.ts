import { NextResponse, type NextRequest } from 'next/server';
import { getLatestSnapshotForMint } from '@/lib/db/tokens';
import { getDevWalletStats } from '@/lib/db/wallets';
import { ensureTokenRowFromDas } from '@/lib/helius/feed';
import { isValidTokenMintParam } from '@/lib/chains/mintKind';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
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
    const snapshot = await getLatestSnapshotForMint(mint);
    const dev = token.creator_wallet
      ? await getDevWalletStats(token.creator_wallet)
      : null;
    return NextResponse.json({ token, snapshot, dev });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'token_detail_failed';
    return NextResponse.json({ error: 'token_detail_failed', message }, { status: 500 });
  }
}
