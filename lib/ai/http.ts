import 'server-only';

import { NextResponse } from 'next/server';
import { ZodError } from 'zod';
import { QuotaError } from '@/lib/ai/quota';
import { AiAccessError } from '@/lib/access/aiAccess';
import { EmergencyBlockedError, emergencyBlockedResponse } from '@/lib/emergency/controls';

/**
 * Clean, human-readable message for a 400 body-parse failure. A raw ZodError's
 * `.message` is the pretty-printed issues JSON (`[{"code":"custom",...}]`) — never
 * send that to a client, or it renders as a wall of JSON in the UI (e.g. the
 * co-pilot on non-token entities like xStocks).
 */
export function badBodyMessage(err: unknown): string {
  if (err instanceof ZodError) return err.issues[0]?.message ?? 'invalid request';
  if (err instanceof SyntaxError) return 'invalid request body';
  return 'invalid_body';
}

/** Standard 400 for a failed body parse — sanitized message, never raw ZodError JSON. */
export function badBodyResponse(err: unknown): NextResponse {
  return NextResponse.json({ error: 'invalid_body', message: badBodyMessage(err) }, { status: 400 });
}

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
