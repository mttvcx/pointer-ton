import { NextResponse, type NextRequest } from 'next/server';
import { requireExtAuth } from '@/lib/ext/auth';
import { submitKolCas } from '@/lib/ext/kolCas';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Record contract addresses seen on a handle's profile — the extension submits
 * the CAs it detected in that account's tweets as the user browses, building
 * Pointer's own CA-history dataset (public tweet facts).
 */
export async function POST(req: NextRequest) {
  const auth = await requireExtAuth(req);
  if ('response' in auth) return auth.response;

  let body: { handle?: unknown; cas?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const handle = typeof body.handle === 'string' ? body.handle : '';
  const cas = Array.isArray(body.cas)
    ? body.cas
        .map((c) => (c && typeof c === 'object' ? (c as { mint?: unknown; chain?: unknown }) : {}))
        .filter((c): c is { mint: string; chain?: string } => typeof c.mint === 'string')
        .map((c) => ({ mint: c.mint, chain: typeof c.chain === 'string' ? c.chain : 'sol' }))
    : [];
  if (!handle.trim() || !cas.length) return NextResponse.json({ ok: true, stored: 0 });

  try {
    const stored = await submitKolCas(handle, cas);
    return NextResponse.json({ ok: true, stored });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}
