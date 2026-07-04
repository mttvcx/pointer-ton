import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { refreshExtSession } from '@/lib/ext/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    refresh: z.string().trim().min(8).max(128),
    ext: z.string().trim().min(8).max(64).regex(/^[a-z0-9._-]+$/i),
  })
  .strict();

/** Silent refresh: exchange the family handle for a fresh access token. A revoked
 *  (deleted) family returns 401 so the extension drops the session. */
export async function POST(req: NextRequest) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const session = await refreshExtSession(body.refresh, body.ext);
  if (!session) return NextResponse.json({ error: 'revoked' }, { status: 401 });
  return NextResponse.json(session);
}
