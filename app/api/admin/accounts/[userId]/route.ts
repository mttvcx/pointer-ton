import { NextResponse, type NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/api/adminAuth';
import { getActiveControl, listControlsForUser } from '@/lib/db/accountControls';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Account Guardian status + history for one user. Superadmin-only. */
export async function GET(req: NextRequest, ctx: { params: Promise<{ userId: string }> }) {
  const auth = await requireAdmin(req, 'account.control');
  if (!auth.ok) return auth.response;

  const { userId } = await ctx.params;
  try {
    const [active, history] = await Promise.all([
      getActiveControl(userId),
      listControlsForUser(userId, 25),
    ]);
    return NextResponse.json({ active, history });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'status_failed';
    return NextResponse.json({ error: 'status_failed', message }, { status: 500 });
  }
}
