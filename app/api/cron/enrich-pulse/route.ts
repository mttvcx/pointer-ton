import type { NextRequest } from 'next/server';
import { cronGetPost } from '@/lib/ingest/cronRoute';
import { runEnrichPulse } from '@/lib/ingest/livePipeline';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return cronGetPost(req, () => runEnrichPulse());
}

export async function POST(req: NextRequest) {
  return GET(req);
}
