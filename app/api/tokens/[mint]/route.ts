import { NextResponse, type NextRequest } from 'next/server';
import { getLatestSnapshotForMint, getTokenByMint } from '@/lib/db/tokens';
import { getDevWalletStats } from '@/lib/db/wallets';
import { ensureTokenRowFromDas } from '@/lib/helius/feed';
import { isValidTokenMintParam } from '@/lib/chains/mintKind';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Bound a promise so a slow upstream can't hang the request. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(label)), ms)),
  ]);
}

type TokenResult = { token: unknown; snapshot: unknown; dev: unknown; degraded: boolean };

async function loadToken(mint: string): Promise<TokenResult | null> {
  const snapshotPromise = getLatestSnapshotForMint(mint).catch(() => null);
  // Helius DAS can hang — bound it, and on failure serve the cached DB token row.
  let token = await withTimeout(ensureTokenRowFromDas(mint), 6_000, 'das_timeout').catch(() => null);
  let degraded = false;
  if (!token) {
    token = await getTokenByMint(mint).catch(() => null);
    degraded = !!token;
  }
  if (!token) return null;
  const dev = token.creator_wallet
    ? await getDevWalletStats(token.creator_wallet).catch(() => null)
    : null;
  const snapshot = await snapshotPromise;
  return { token, snapshot, dev, degraded };
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
    // Hard overall budget: the route ALWAYS answers within ~8s (fail-fast during a
    // DB/provider outage) instead of summing per-call timeouts into a 20s hang.
    const result = await withTimeout(loadToken(mint), 8_000, 'token_route_timeout');
    if (!result) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    return NextResponse.json(result);
  } catch {
    // Upstream (DB/Helius) unavailable — respond fast so the UI shows "reconnecting"
    // instead of a long hang. Cache-control short so clients retry soon.
    return NextResponse.json(
      { error: 'degraded', message: 'upstream_unavailable' },
      { status: 503, headers: { 'cache-control': 'no-store' } },
    );
  }
}
