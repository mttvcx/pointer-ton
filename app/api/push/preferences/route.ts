import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requirePointerUser } from '@/lib/api/privyUser';
import { getPushPreferences, upsertPushPreferences } from '@/lib/db/pushPreferences';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** GET /api/push/preferences — per-account push toggles (web + mobile share them). */
export async function GET(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;
  try {
    return NextResponse.json({ preferences: await getPushPreferences(auth.user.id) });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'read_failed' }, { status: 500 });
  }
}

const PatchBody = z
  .object({
    trackedWallet: z.boolean().optional(),
    xMonitor: z.boolean().optional(),
    price: z.boolean().optional(),
    autoBuyFill: z.boolean().optional(),
  })
  .strict();

/** PATCH /api/push/preferences — partial update of the toggles. */
export async function PATCH(req: NextRequest) {
  const auth = await requirePointerUser(req);
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = PatchBody.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'invalid_body', issues: parsed.error.issues }, { status: 400 });

  try {
    const preferences = await upsertPushPreferences(auth.user.id, parsed.data);
    return NextResponse.json({ preferences });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'update_failed' }, { status: 500 });
  }
}
