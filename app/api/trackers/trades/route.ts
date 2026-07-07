import { NextResponse, type NextRequest, after } from 'next/server';
import { listTrackedWalletTradesForUser, mintsMissingMetadata } from '@/lib/db/trackerTrades';
import { ensureTokenRowFromDas } from '@/lib/helius/feed';
import { getUserByPrivyId } from '@/lib/db/users';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { isAppChainId, type AppChainId } from '@/lib/chains/appChain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Live trades from THIS user's tracked wallets (real parsed swaps from mint_swaps). */
export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const accessToken = authHeader?.startsWith('Bearer ')
    ? authHeader.slice('Bearer '.length).trim()
    : null;
  if (!accessToken) {
    return NextResponse.json({ error: 'missing_authorization' }, { status: 401 });
  }

  let verified;
  try {
    verified = await verifyPrivyAccessToken(accessToken);
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  const user = await getUserByPrivyId(verified.privyId);
  if (!user) {
    return NextResponse.json(
      { error: 'user_not_synced', message: 'Call /api/auth/sync first' },
      { status: 403 },
    );
  }

  const limitParam = req.nextUrl.searchParams.get('limit');
  const limit = Math.min(80, Math.max(1, limitParam ? Number(limitParam) || 40 : 40));
  const chainParam = req.nextUrl.searchParams.get('chain');
  const chain: AppChainId = chainParam && isAppChainId(chainParam) ? chainParam : 'sol';

  try {
    const trades = await listTrackedWalletTradesForUser(user.id, chain, limit);

    // Progressive enrichment: fill the token cache for mints still missing
    // symbol/image so the next poll shows them. Post-response, capped, and
    // cache-safe (already-enriched mints don't re-hit DAS). Solana-only —
    // ensureTokenRowFromDas is a Helius (SOL) call.
    if (chain === 'sol') {
      const missing = mintsMissingMetadata(trades).slice(0, 8);
      if (missing.length) {
        after(() => Promise.allSettled(missing.map((m) => ensureTokenRowFromDas(m))));
      }
    }

    return NextResponse.json({ trades });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'trades_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
