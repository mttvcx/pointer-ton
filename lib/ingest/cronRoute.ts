import { NextResponse, type NextRequest } from 'next/server';
import { authorizeCronRequest } from '@/lib/cron/authorize';
import { revalidatePulseFeedCache } from '@/lib/server/revalidatePulseFeed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type CronHandler = () => Promise<Record<string, unknown>>;

export async function runAuthorizedCron(
  req: NextRequest,
  handler: CronHandler,
  opts?: { revalidatePulse?: boolean },
): Promise<NextResponse> {
  if (!authorizeCronRequest(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (process.env.POINTER_PAUSE_INGEST === '1') {
    return NextResponse.json({ ok: true, paused: true, reason: 'POINTER_PAUSE_INGEST' });
  }
  try {
    const result = await handler();
    if (opts?.revalidatePulse !== false) {
      revalidatePulseFeedCache();
    }
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'cron_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function cronGetPost(req: NextRequest, handler: CronHandler) {
  return runAuthorizedCron(req, handler);
}
