import { NextResponse, type NextRequest } from 'next/server';
import { requirePointerUser } from '@/lib/api/privyUser';
import { listWalletMarkersForTrackedTradesOnMint } from '@/lib/db/trackedWalletMarkers';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  ctx: { params: Promise<{ mint: string }> },
) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  const { mint } = await ctx.params;
  if (!isValidPublicKey(mint)) {
    return NextResponse.json({ error: 'invalid_mint' }, { status: 400 });
  }

  const limit = Math.min(500, Math.max(1, Number(req.nextUrl.searchParams.get('limit')) || 120));

  try {
    const rows = await listWalletMarkersForTrackedTradesOnMint(auth.user.id, mint, limit);
    return NextResponse.json({
      markers: rows.map((m) => ({
        time: Math.floor(new Date(m.timeIso).getTime() / 1000),
        side: m.side,
        walletAddress: m.walletAddress,
        trackerLabel: m.trackerLabel,
        txSignature: m.txSignature,
      })),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'wallet_markers_failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
