import { NextResponse, type NextRequest } from 'next/server';
import { getLatestSnapshotsForMints, getTokenByMint, listTokensByCreatorWallet } from '@/lib/db/tokens';
import { isPointerQaMint } from '@/lib/qa/pointerQaMint';
import { isValidPublicKey } from '@/lib/utils/addresses';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Live dev-token list for QA mint only — avoids demo fixtures + limits DB blast radius. */
export async function GET(
  _req: NextRequest,
  ctx: { params: Promise<{ mint: string }> },
) {
  const { mint } = await ctx.params;
  if (!isValidPublicKey(mint)) {
    return NextResponse.json({ error: 'invalid_mint' }, { status: 400 });
  }
  if (!isPointerQaMint(mint)) {
    return NextResponse.json({ tokens: [], qaOnly: true });
  }

  const token = await getTokenByMint(mint);
  const creator = token?.creator_wallet?.trim();
  if (!creator) {
    return NextResponse.json({ tokens: [], creator: null });
  }

  const rows = await listTokensByCreatorWallet(creator, 40);
  const snaps = await getLatestSnapshotsForMints(rows.map((t) => t.mint));
  const tokens = rows.map((t) => {
    const snap = snaps.get(t.mint);
    return {
      mint: t.mint,
      symbol: t.symbol,
      name: t.name,
      created_at: t.created_at,
      migrated_at: t.migrated_at,
      market_cap_usd: snap?.market_cap_usd ?? null,
      volume_24h_usd: snap?.volume_24h_usd ?? null,
      is_current: t.mint === mint,
    };
  });

  return NextResponse.json({ creator, tokens });
}
