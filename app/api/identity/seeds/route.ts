import { NextResponse } from 'next/server';
import { loadIdentitySeedRowsFromDb } from '@/lib/db/identityRegistry';
import type { IdentitySeedRow } from '@/lib/identity/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The full identity directory (2k+ KOLs w/ twitters + avatars) for CLIENT
 * hydration of the in-memory registry. It's the same public directory for every
 * user, so it's cached server-side (module TTL) + at the edge (Cache-Control).
 * User-specific labels are NOT here — those come from `/api/identity/lookup`.
 */
let cache: { at: number; rows: SlimSeed[] } | null = null;
const TTL_MS = 5 * 60_000;

type SlimSeed = Pick<
  IdentitySeedRow,
  'chain' | 'address' | 'displayName' | 'avatarUrl' | 'twitterHandle' | 'category' | 'badges' | 'source' | 'verified'
>;

function slim(rows: IdentitySeedRow[]): SlimSeed[] {
  return rows.map((r) => ({
    chain: r.chain,
    address: r.address,
    displayName: r.displayName,
    avatarUrl: r.avatarUrl ?? null,
    twitterHandle: r.twitterHandle ?? null,
    category: r.category,
    badges: r.badges,
    source: r.source,
    verified: r.verified,
  }));
}

export async function GET() {
  try {
    if (!cache || Date.now() - cache.at > TTL_MS) {
      const rows = await loadIdentitySeedRowsFromDb();
      cache = { at: Date.now(), rows: slim(rows) };
    }
    return NextResponse.json(
      { seeds: cache.rows },
      { headers: { 'Cache-Control': 'public, max-age=300, stale-while-revalidate=1800' } },
    );
  } catch (err) {
    return NextResponse.json({ seeds: [], error: err instanceof Error ? err.message : 'failed' });
  }
}
