import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSyncedUser } from '@/lib/ai/auth';
import { getPointerIdentity, putPointerIdentity } from '@/lib/db/pointerIdentities';
import { PointerIdentitySchema } from '@/lib/squads/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PutSchema = z
  .object({
    identity: PointerIdentitySchema,
  })
  .strict();

export async function GET(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  const identity = await getPointerIdentity(auth.user.id);
  return NextResponse.json({ identity });
}

export async function PUT(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof PutSchema>;
  try {
    body = PutSchema.parse(await req.json());
  } catch (e) {
    const message = e instanceof Error ? e.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  const identity = await putPointerIdentity(auth.user.id, body.identity);
  return NextResponse.json({ identity });
}
