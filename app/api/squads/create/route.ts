import { NextResponse, type NextRequest } from 'next/server';
import { requireSyncedUser } from '@/lib/ai/auth';
import { createSquad, isMissingSquadsTable } from '@/lib/db/squads';
import { SquadCreateSchema } from '@/lib/squads/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** POST /api/squads/create — create a squad; creator becomes active owner. */
export async function POST(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const parsed = SquadCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'invalid_params', issues: parsed.error.issues }, { status: 400 });
  }

  try {
    const squad = await createSquad(auth.user.id, parsed.data);
    return NextResponse.json({ squad });
  } catch (err) {
    if (isMissingSquadsTable(err)) {
      return NextResponse.json({ error: 'not_provisioned', provisioned: false }, { status: 503 });
    }
    const message = err instanceof Error ? err.message : 'create_failed';
    return NextResponse.json({ error: 'create_failed', message }, { status: 500 });
  }
}
