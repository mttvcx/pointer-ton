import type { NextRequest } from 'next/server';
import { runAuthorizedCron } from '@/lib/ingest/cronRoute';
import { runDrainWebhooks } from '@/lib/webhooks/drain';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Retry backstop for webhook processing: drains due retries, dead-letters
 *  exhausted jobs, and records retry/DLQ depth gauges. */
export async function GET(req: NextRequest) {
  return runAuthorizedCron(req, async () => ({ providers: await runDrainWebhooks() }), {
    revalidatePulse: false,
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
