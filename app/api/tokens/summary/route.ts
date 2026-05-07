import { NextResponse, type NextRequest } from 'next/server';
import { getTokensByMints } from '@/lib/db/tokens';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MAX_MINTS = 25;

type SummaryToken = {
  mint: string;
  symbol: string | null;
  name: string | null;
  image_url: string | null;
};

/**
 * Lightweight token metadata for search history / lists (no DAS).
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
    const map = await getTokensByMints(mints);
    const tokens: SummaryToken[] = mints.map((mint) => {
      const row = map.get(mint);
      return {
        mint,
        symbol: row?.symbol ?? null,
        name: row?.name ?? null,
        image_url: row?.image_url ?? null,
      };
    });
    return NextResponse.json({ tokens });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'summary failed';
    return NextResponse.json({ error: 'summary_failed', message }, { status: 500 });
  }
}
