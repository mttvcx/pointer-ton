import { type NextRequest, NextResponse } from 'next/server';
import { requireAnyAdmin } from '@/lib/api/adminAuth';
import { getMetricCards } from '@/lib/db/opsMetrics';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Observability dashboard data — per-metric rollups over the last 24h from
 *  ops_metrics (webhook latency/throughput, retry/DLQ depth, cron duration). */
export async function GET(req: NextRequest) {
  const auth = await requireAnyAdmin(req);
  if (!auth.ok) return auth.response;
  return NextResponse.json(await getMetricCards());
}
