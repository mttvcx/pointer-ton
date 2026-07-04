import type { NextRequest } from 'next/server';
import { cronGetPost } from '@/lib/ingest/cronRoute';
import { runXMonitorIngest } from '@/lib/twitter/xIngest';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * X Monitor ingest tick — pulls new tweets from watched handles (from users'
 * active rules) and runs the alert/auto-buy/auto-launch engine. No-op until
 * TWITTER_BEARER_TOKEN is set, so this can ship dormant and activate the moment
 * the token lands in the env. Registered in vercel.json (every minute).
 */
export async function GET(req: NextRequest) {
  return cronGetPost(req, () => runXMonitorIngest());
}

export async function POST(req: NextRequest) {
  return GET(req);
}
