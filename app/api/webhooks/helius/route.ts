import { randomUUID } from 'node:crypto';
import { NextResponse, after, type NextRequest } from 'next/server';
import {
  processHeliusWebhookBody,
  verifyHeliusWebhookAuthorization,
} from '@/lib/helius/webhooks';
import { recordOpsMetric } from '@/lib/ops/events';
import { isReadOnly } from '@/lib/emergency/controls';
import { claimWebhook } from '@/lib/webhooks/idempotency';
import { runWebhookJob } from '@/lib/webhooks/runner';
import type { WebhookJob } from '@/lib/webhooks/queue';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const PROVIDER = 'helius';

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

/**
 * Helius enhanced-transaction webhook.
 *
 * Production contract: respond IMMEDIATELY (never block the ACK on heavy work —
 * a slow ack triggers Helius retry storms), then process out of band via
 * `after()`. Processing failures are retried with capped exponential backoff and
 * dead-lettered after exhaustion (lib/webhooks/*), drained by the
 * `/api/cron/drain-webhooks` cron. Idempotency is a durable 24h claim plus
 * idempotent downstream writes. Read-only/maintenance ACKs without processing.
 */
export async function POST(req: NextRequest) {
  const authorized = verifyHeliusWebhookAuthorization(
    req.headers.get('authorization'),
    process.env.HELIUS_WEBHOOK_AUTH_TOKEN,
  );
  if (!authorized) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // Emergency maintenance / read-only: ingestion is a write path, so ACK without
  // processing (200 prevents Helius retry storms). Fails closed.
  if (await isReadOnly()) {
    return NextResponse.json({ ok: true, skipped: 'read_only', accepted: false });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const signature = extractSignature(body);

  // Durable idempotency (24h) — replaces the old 60s window.
  const claimed = await claimWebhook(PROVIDER, signature);
  if (!claimed) {
    void recordOpsMetric('webhook.deduped', 1, { provider: PROVIDER });
    return NextResponse.json({ ok: true, deduped: true, accepted: false });
  }

  void recordOpsMetric('webhook.received', 1, { provider: PROVIDER });

  const job: WebhookJob = {
    id: signature,
    provider: PROVIDER,
    signature,
    payload: body,
    attempt: 0,
    firstSeenAt: Date.now(),
  };

  // Process AFTER the response is sent. runWebhookJob handles success/retry/DLQ
  // + metrics; a crash mid-processing is recovered because failures persist to
  // the retry queue (and the drain cron is the backstop).
  after(async () => {
    await runWebhookJob(job, (j) =>
      processHeliusWebhookBody(j.payload, { source: PROVIDER, signature: j.signature }),
    );
  });

  return NextResponse.json({ ok: true, accepted: true, signature });
}
