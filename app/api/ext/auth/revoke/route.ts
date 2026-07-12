import { NextResponse, type NextRequest } from 'next/server';
import { requireExtAuth } from '@/lib/ext/auth';
import { revokeExtFamily } from '@/lib/ext/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Revoke this extension session (the family). Authed by the scoped token itself,
 *  so a user can disconnect from the extension; pointer.am can also revoke a
 *  listed connection server-side via the same family handle. */
export async function POST(req: NextRequest) {
  const auth = await requireExtAuth(req);
  if ('response' in auth) return auth.response;
  await revokeExtFamily(auth.fam);
  return NextResponse.json({ ok: true });
}
