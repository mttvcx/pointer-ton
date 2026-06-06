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
    // Snapshot only needs the mint, so fetch it alongside the token row.
    const snapshotPromise = getLatestSnapshotForMint(mint);
    const token = await ensureTokenRowFromDas(mint);
    if (!token) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    const devPromise = token.creator_wallet
      ? getDevWalletStats(token.creator_wallet)
      : Promise.resolve(null);
    const [snapshot, dev] = await Promise.all([snapshotPromise, devPromise]);
    return NextResponse.json({ token, snapshot, dev });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'token_detail_failed';
    return NextResponse.json({ error: 'token_detail_failed', message }, { status: 500 });
  }
}
