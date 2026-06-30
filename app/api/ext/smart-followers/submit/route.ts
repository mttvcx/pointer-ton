import { NextResponse, type NextRequest } from 'next/server';
import { requireExtAuth } from '@/lib/ext/auth';
import { submitSmartFollowers } from '@/lib/ext/smartFollowers';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Record an account's followers that X rendered on its followers page — we keep
 * the ones that are known KOLs in the directory (smart followers).
 */
export async function POST(req: NextRequest) {
  const auth = await requireExtAuth(req);
  if ('response' in auth) return auth.response;

  let body: { handle?: unknown; followers?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const handle = typeof body.handle === 'string' ? body.handle : '';
  const followers = Array.isArray(body.followers) ? body.followers.filter((f): f is string => typeof f === 'string') : [];
  if (!handle.trim() || !followers.length) return NextResponse.json({ ok: true, stored: 0 });

  try {
    const stored = await submitSmartFollowers(handle, followers);
    return NextResponse.json({ ok: true, stored });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'failed' }, { status: 500 });
  }
}
