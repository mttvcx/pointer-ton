import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyPrivyAccessToken } from '@/lib/privy/config';
import { getUserByPrivyId } from '@/lib/db/users';
import { mintConnectCode } from '@/lib/ext/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Chrome extension ids are 32 chars [a-p]; allow a generous bound for other browsers.
const Body = z.object({ ext: z.string().trim().min(8).max(64).regex(/^[a-z0-9._-]+$/i) }).strict();

/**
 * Called by the logged-in `/extension/connect` page (Privy session). Mints a
 * single-use connect code the page hands to the extension; the extension exchanges
 * it server-side for a scoped token, so the token never touches the web page's JS.
 */
export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;
  if (!token) return NextResponse.json({ error: 'unauthenticated' }, { status: 401 });

  let userId: string;
  try {
    const verified = await verifyPrivyAccessToken(token);
    const user = await getUserByPrivyId(verified.privyId);
    if (!user) return NextResponse.json({ error: 'user_not_synced' }, { status: 403 });
    userId = user.id;
  } catch {
    return NextResponse.json({ error: 'invalid_token' }, { status: 401 });
  }

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const code = await mintConnectCode(userId, body.ext);
  return NextResponse.json({ code });
}
