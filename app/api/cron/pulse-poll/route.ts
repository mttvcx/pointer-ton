import type { NextRequest } from 'next/server';
import { cronGetPost } from '@/lib/ingest/cronRoute';
import { runDiscoverTokens } from '@/lib/ingest/livePipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** @deprecated Prefer `/api/cron/discover-tokens` — kept for Vercel schedule compat. */
export async function GET(req: NextRequest) {
  return cronGetPost(req, () => runDiscoverTokens());
}

export async function POST(req: NextRequest) {
  return GET(req);
}
