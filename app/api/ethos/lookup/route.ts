import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSyncedUser } from '@/lib/ai/auth';
import { lookupEthosByKey } from '@/lib/ethos/client';
import { EthosLookupKeyTypeSchema } from '@/lib/ethos/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({
    type: EthosLookupKeyTypeSchema,
    value: z.string().trim().min(1).max(256),
  })
  .strict();

/**
 * Read-only Ethos lookup for the client UI.
 *
 * Phase 1 design choices:
 *  - Authenticated (requires a synced Pointer user) so we don't expose a
 *    free passthrough proxy to Ethos.
 *  - All caching happens inside `lookupEthosByKey`. The route is thin.
 *  - 200 with `{ profile: null }` is the *not-found* response; the UI
 *    never treats this as an error.
 */
export async function POST(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof BodySchema>;
  try {
    body = BodySchema.parse(await req.json());
  } catch (err) {
    const message = err instanceof Error ? err.message : 'invalid_body';
    return NextResponse.json({ error: 'invalid_body', message }, { status: 400 });
  }

  const profile = await lookupEthosByKey(body.type, body.value);
  return NextResponse.json({ profile });
}
