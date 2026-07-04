import 'server-only';

import { NextResponse } from 'next/server';
import { QuotaError } from '@/lib/ai/quota';
import { AiAccessError } from '@/lib/access/aiAccess';
import { EmergencyBlockedError, emergencyBlockedResponse } from '@/lib/emergency/controls';

/** Convert exceptions raised by the cascade or pipelines into JSON responses. */
export function aiErrorResponse(err: unknown): NextResponse {
  if (err instanceof EmergencyBlockedError) return emergencyBlockedResponse(err);
  if (err instanceof AiAccessError) {
    return NextResponse.json(
      { error: 'ai_access_denied', message: err.decision.reason, access: err.decision },
      { status: 403 },
    );
  }
  if (err instanceof QuotaError) {
    const headers: HeadersInit | undefined = err.retryAfterSeconds
      ? { 'Retry-After': String(err.retryAfterSeconds) }
      : undefined;
    return NextResponse.json(
      {
        error: err.code,
        message: err.message,
        retryAfterSeconds: err.retryAfterSeconds,
      },
      { status: err.status, headers },
    );
  }
  const message = err instanceof Error ? err.message : 'ai_request_failed';
  console.error('[ai] request failed:', message);
  return NextResponse.json({ error: 'ai_request_failed', message }, { status: 500 });
}
