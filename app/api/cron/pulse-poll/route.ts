import { NextResponse, type NextRequest } from 'next/server';
import { timingSafeEqual } from 'node:crypto';
import { runScheduledPulsePoll } from '@/lib/helius/feed';
import { revalidatePulseFeedCache } from '@/lib/server/revalidatePulseFeed';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) {
    return process.env.NODE_ENV !== 'production';
  }
  const auth = req.headers.get('authorization');
  const bearer = auth?.startsWith('Bearer ') ? auth.slice('Bearer '.length).trim() : null;
  if (bearer) {
    const a = Buffer.from(bearer);
    const b = Buffer.from(secret);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  const header = req.headers.get('x-cron-secret')?.trim();
  if (header) {
    const a = Buffer.from(header);
    const b = Buffer.from(secret);
    if (a.length === b.length && timingSafeEqual(a, b)) return true;
  }
  return false;
}

export async function GET(req: NextRequest) {
  if (!authorizeCron(req)) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  if (process.env.POINTER_PAUSE_INGEST === '1') {
    return NextResponse.json({ ok: true, paused: true, reason: 'POINTER_PAUSE_INGEST' });
  }
  try {
    const result = await runScheduledPulsePoll();
    revalidatePulseFeedCache();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'poll_failed';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  return GET(req);
}
