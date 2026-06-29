import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { consumeConnectCode } from '@/lib/ext/token';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    code: z.string().trim().min(8).max(128),
    ext: z.string().trim().min(8).max(64).regex(/^[a-z0-9._-]+$/i),
  })
  .strict();

/** Extension exchanges a single-use connect code for a scoped session token. */
export async function POST(req: NextRequest) {
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }
  const session = await consumeConnectCode(body.code, body.ext);
  if (!session) return NextResponse.json({ error: 'invalid_or_expired_code' }, { status: 400 });
  return NextResponse.json(session);
}
