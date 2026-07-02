import { NextResponse, type NextRequest } from 'next/server';
import { getLatestSnapshotForMint, getTokenByMint } from '@/lib/db/tokens';
import { getDevWalletStats } from '@/lib/db/wallets';
import { ensureTokenRowFromDas } from '@/lib/helius/feed';
import { isValidTokenMintParam } from '@/lib/chains/mintKind';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Bound a promise so a slow upstream (Helius DAS) can't hang the request. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);
}

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
    const snapshotPromise = getLatestSnapshotForMint(mint).catch(() => null);

    // Resilience: bound the Helius DAS lookup (it can hang when Helius is slow),
    // and on timeout/error fall back to the cached token row from the DB so the
    // hot Pulse path degrades to last-known data instead of hanging / 500-ing.
    let token = await withTimeout(ensureTokenRowFromDas(mint), 6_000, 'das_timeout').catch(
      () => null,
    );
    let degraded = false;
    if (!token) {
      token = await getTokenByMint(mint).catch(() => null);
      degraded = !!token;
    }
    if (!token) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const devPromise = token.creator_wallet
      ? getDevWalletStats(token.creator_wallet).catch(() => null)
      : Promise.resolve(null);
    const [snapshot, dev] = await Promise.all([snapshotPromise, devPromise]);
    return NextResponse.json({ token, snapshot, dev, degraded });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'token_detail_failed';
    return NextResponse.json({ error: 'token_detail_failed', message }, { status: 500 });
  }
}
