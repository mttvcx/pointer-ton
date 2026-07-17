import { NextResponse, type NextRequest } from 'next/server';
import { getLatestSnapshotsForMints, getTokensByMints } from '@/lib/db/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MINTS = 25;

type SummaryToken = {
  mint: string;
  symbol: string | null;
  name: string | null;
  image_url: string | null;
  /** Launchpad / DEX the token belongs to — drives the protocol filter chips. */
  protocol_id: string | null;
  protocol_family: string | null;
  /** Latest DB snapshot metrics — null when never snapshotted (render `—`). */
  market_cap_usd: number | null;
  volume_24h_usd: number | null;
  liquidity_usd: number | null;
  created_at: string | null;
};

function num(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Lightweight token metadata + latest snapshot metrics for search history / lists.
 */
export async function GET(req: NextRequest) {
  const raw = req.nextUrl.searchParams.get('mints') ?? '';
  const mints = raw
    .split(',')
    .map((m) => m.trim())
    .filter(Boolean)
    .slice(0, MAX_MINTS);
  if (mints.length === 0) {
    return NextResponse.json({ tokens: [] satisfies SummaryToken[] });
  }
  try {
    const [map, snaps] = await Promise.all([
      getTokensByMints(mints),
      getLatestSnapshotsForMints(mints).catch(() => new Map()),
    ]);
    const tokens: SummaryToken[] = mints.map((mint) => {
      const row = map.get(mint);
      const snap = snaps.get(mint);
      return {
        mint,
        symbol: row?.symbol ?? null,
        name: row?.name ?? null,
        image_url: row?.image_url ?? null,
        protocol_id: row?.protocol_id ?? null,
        protocol_family: row?.protocol_family ?? null,
        market_cap_usd: num(snap?.market_cap_usd),
        volume_24h_usd: num(snap?.volume_24h_usd),
        liquidity_usd: num(snap?.liquidity_usd),
        created_at: row?.created_at ?? null,
      };
    });
    return NextResponse.json({ tokens });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'summary failed';
    return NextResponse.json({ error: 'summary_failed', message }, { status: 500 });
  }
}
