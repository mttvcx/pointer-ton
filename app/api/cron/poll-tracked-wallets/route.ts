import type { NextRequest } from 'next/server';
import { cronGetPost } from '@/lib/ingest/cronRoute';
import { runPollTrackedWallets } from '@/lib/ingest/pollTrackedWalletsJob';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  return cronGetPost(req, () => runPollTrackedWallets());
}

export async function POST(req: NextRequest) {
  return GET(req);
}
