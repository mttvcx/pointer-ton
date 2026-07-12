import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireSyncedUser } from '@/lib/ai/auth';
import { aiErrorResponse, badBodyResponse } from '@/lib/ai/http';
import { narrateAlert } from '@/lib/ai/pipelines/narrateAlert';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const Body = z
  .object({
    alertId: z.string().uuid(),
  })
  .strict();

export async function POST(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    return badBodyResponse(err);
  }

  try {
    const out = await narrateAlert({
      alertId: body.alertId,
      userId: auth.user.id,
    });
    return NextResponse.json(out);
  } catch (err) {
    // Not-found and not-owned are deliberately collapsed (no existence oracle).
    if (err instanceof Error && err.message === 'alert_not_found') {
      return NextResponse.json({ error: 'alert_not_found' }, { status: 404 });
    }
    return aiErrorResponse(err);
  }
}
