import { NextResponse, type NextRequest } from 'next/server';
import { requireSyncedUser } from '@/lib/ai/auth';
import { getAiAccess, aiAccessEnforced } from '@/lib/access/aiAccess';
import { aiAccessHeadline } from '@/lib/access/aiAccessDecision';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** "Why do I have / not have AI access?" — the current decision (basis + reason +
 *  holdings vs threshold) plus whether enforcement is on. Drives the upgrade UI. */
export async function GET(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;
  try {
    const decision = await getAiAccess(auth.user.id);
    return NextResponse.json({
      enforced: aiAccessEnforced(),
      headline: aiAccessHeadline(decision),
      ...decision,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'access_check_failed';
    return NextResponse.json({ error: 'access_check_failed', message }, { status: 500 });
  }
}
