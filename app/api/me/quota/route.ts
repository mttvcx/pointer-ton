import { NextResponse, type NextRequest } from 'next/server';
import { requirePointerUser } from '@/lib/api/privyUser';
import { getCapForUser, getCostUsedToday, getRateLimitState } from '@/lib/ai/quota';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The signed-in user's AI quota state: daily cost ceiling + usage and the
 * sliding-window rate-limit budget. Read-only; lets non-web clients (the
 * extension) show "AI calls/$ left today" without guessing the limits.
 */
export async function GET(req: NextRequest) {
  const r = await requirePointerUser(req);
  if ('error' in r) return r.error;

  try {
    const [cap, used, rateLimit] = await Promise.all([
      getCapForUser(r.user.id),
      getCostUsedToday(r.user.id),
      getRateLimitState(r.user.id),
    ]);
    return NextResponse.json({
      ai: {
        dailyCostCapUsd: cap,
        costUsedTodayUsd: used,
        costRemainingUsd: Math.max(0, cap - used),
        rateLimit,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
