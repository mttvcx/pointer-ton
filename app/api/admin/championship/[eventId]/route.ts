import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/adminAuth';
import { listParticipants, getChampionshipEvent, getFinalization } from '@/lib/db/championship';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest, ctx: { params: Promise<{ eventId: string }> }) {
  const auth = await requireAdmin(req, 'championship.read');
  if (!auth.ok) return auth.response;
  const { eventId } = await ctx.params;
  try {
    const [event, participants, finalization] = await Promise.all([
      getChampionshipEvent(eventId),
      listParticipants(eventId),
      getFinalization(eventId),
    ]);
    if (!event) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    return NextResponse.json({ event, participants, finalization });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'get_failed';
    return NextResponse.json({ error: 'get_failed', message }, { status: 500 });
  }
}
