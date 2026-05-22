import { NextResponse, type NextRequest } from 'next/server';
import { requireSyncedUser } from '@/lib/ai/auth';
import { authorizeAdminRequest } from '@/lib/admin/authorize';
import { aggregateHeliusUsageStats, listHeliusUsageSince } from '@/lib/db/heliusUsage';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function startOfUtcDayIso(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

export async function GET(req: NextRequest) {
  const auth = await requireSyncedUser(req);
  if (!auth.ok) return auth.response;
  if (!authorizeAdminRequest(req, auth.user.wallet_address)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  try {
    const since = startOfUtcDayIso();
    const rows = await listHeliusUsageSince(since);
    const stats = aggregateHeliusUsageStats(rows);
    return NextResponse.json({ since, stats });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'stats_failed';
    return NextResponse.json({ error: 'stats_failed', message }, { status: 500 });
  }
}
