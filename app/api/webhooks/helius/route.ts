import { randomUUID } from 'node:crypto';
import { NextResponse, type NextRequest } from 'next/server';
import {
  processHeliusWebhookBody,
  verifyHeliusWebhookAuthorization,
} from '@/lib/helius/webhooks';
import { claimHeliusWebhookSignature } from '@/lib/helius/webhookDedup';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function extractSignature(body: unknown): string {
  if (Array.isArray(body) && body.length > 0) {
    const first = body[0];
    if (first && typeof first === 'object' && first !== null && 'signature' in first) {
      const s = (first as { signature?: unknown }).signature;
      if (typeof s === 'string' && s.length > 0) return s;
    }
  }
  if (body && typeof body === 'object' && body !== null && 'signature' in body) {
    const s = (body as { signature?: unknown }).signature;
    if (typeof s === 'string' && s.length > 0) return s;
  }
  return randomUUID();
}

export async function POST(req: NextRequest) {
  const authorized = verifyHeliusWebhookAuthorization(
    req.headers.get('authorization'),
    process.env.HELIUS_WEBHOOK_AUTH_TOKEN,
  );
  if (!authorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const signature = extractSignature(body);

  const claimed = await claimHeliusWebhookSignature(signature);
  if (!claimed) {
    return NextResponse.json({
      ok: true,
      deduped: true,
      events: 0,
      tokensUpserted: 0,
      alerts: 0,
      migrations: 0,
      qaSwaps: null,
    });
  }

  try {
    const result = await processHeliusWebhookBody(body, { source: 'helius', signature });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'webhook_failed';
    return NextResponse.json({ error: 'webhook_failed', message }, { status: 500 });
  }
}
