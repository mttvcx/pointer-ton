import { NextResponse, type NextRequest } from 'next/server';
import { authorizeCronRequest } from '@/lib/cron/authorize';
import { revalidatePulseFeedCache } from '@/lib/server/revalidatePulseFeed';
import { recordOpsEvent, recordOpsMetric } from '@/lib/ops/events';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CronHandler = () => Promise<Record<string, unknown>>;

/** Derive the cron name from the request path, e.g. /api/cron/discover-tokens -> discover-tokens. */
function cronNameFromRequest(req: NextRequest): string {
  const parts = req.nextUrl.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'unknown';
}

export async function runAuthorizedCron(
  req: NextRequest,
  handler: CronHandler,
  opts?: { revalidatePulse?: boolean },
): Promise<NextResponse> {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const cron = cronNameFromRequest(req);
  if (process.env.POINTER_PAUSE_INGEST === '1') {
    await recordOpsEvent({ category: 'cron', name: cron, status: 'paused', message: 'POINTER_PAUSE_INGEST' });
    return NextResponse.json({ ok: true, paused: true, reason: 'POINTER_PAUSE_INGEST' });
  }
  const startedAt = Date.now();
  try {
    const result = await handler();
    const durationMs = Date.now() - startedAt;
    if (opts?.revalidatePulse !== false) {
      revalidatePulseFeedCache();
    }
    await recordOpsEvent({ category: 'cron', name: cron, status: 'ok', durationMs, detail: result });
    void recordOpsMetric('cron.duration_ms', durationMs, { cron });
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : 'cron_failed';
    await recordOpsEvent({ category: 'cron', name: cron, status: 'error', severity: 'error', durationMs, message });
    void recordOpsMetric('cron.duration_ms', durationMs, { cron, error: '1' });
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function cronGetPost(req: NextRequest, handler: CronHandler) {
  return runAuthorizedCron(req, handler);
}
