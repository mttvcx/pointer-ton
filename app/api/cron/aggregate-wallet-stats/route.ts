import type { NextRequest } from 'next/server';
import { cronGetPost } from '@/lib/ingest/cronRoute';
import { runAggregateWalletStats } from '@/lib/ingest/aggregateWalletStatsJob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return cronGetPost(req, () => runAggregateWalletStats());
}

export async function POST(req: NextRequest) {
  return GET(req);
}
