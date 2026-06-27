import { NextResponse, type NextRequest } from 'next/server';
import { requireAnyAdmin } from '@/lib/api/adminAuth';
import { collectOpsHealth } from '@/lib/db/opsHealth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Pointer Ops — live System Health snapshot. Any authenticated admin may read
 * it (read-only, no secrets exposed; provider config is surfaced as booleans
 * only). The collector reports honest per-section errors rather than faking
 * health.
 */
export async function GET(req: NextRequest) {
  const auth = await requireAnyAdmin(req);
  if (!auth.ok) return auth.response;
  try {
    const snapshot = await collectOpsHealth();
    return NextResponse.json(snapshot);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'ops_health_failed';
    return NextResponse.json({ error: 'ops_health_failed', message }, { status: 500 });
  }
}
