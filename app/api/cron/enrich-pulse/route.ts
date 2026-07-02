import type { NextRequest } from 'next/server';
import { cronGetPost } from '@/lib/ingest/cronRoute';
import { runEnrichPulse } from '@/lib/ingest/livePipeline';
import { warmPulseFeeds } from '@/lib/server/cachedPulseFeed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return cronGetPost(req, async () => {
    const result = await runEnrichPulse();
    // Keep the cross-instance warm feed cache (L2) populated so cold instances
    // never block on the heavy pipeline for the first user.
    await warmPulseFeeds(['sol']).catch(() => undefined);
    return result;
  });
}

export async function POST(req: NextRequest) {
  return GET(req);
}
