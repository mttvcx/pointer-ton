import type { NextRequest } from 'next/server';
import { cronGetPost } from '@/lib/ingest/cronRoute';
import { runRefreshKolStats } from '@/lib/ingest/refreshKolStatsJob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  return cronGetPost(req, () => runRefreshKolStats());
}

export async function POST(req: NextRequest) {
  return GET(req);
}
