import 'server-only';

import { createAdminSupabase } from '@/lib/supabase/server';
import type { Json } from '@/lib/supabase/types';

/**
 * Pointer Ops — the structured event/metric emitter (the observability
 * substrate's write side). Every cron, webhook, trade, provider call and
 * self-heal action records here so Mission Control reads REAL history instead
 * of guessing.
 *
 * Hard rules:
 *   - NEVER throws into the caller. Telemetry must not break production paths;
 *     every write is best-effort and swallows its own errors.
 *   - NEVER record secrets / PII. `message` is a short human summary; `detail`
 *     is structured context — keep both free of keys, tokens, raw wallets, etc.
 *   - Writes go through the service role (createAdminSupabase); the tables have
 *     RLS enabled with no policies, so the anon key can't read them.
 */

export type OpsEventCategory =
  | 'cron'
  | 'webhook'
  | 'trade'
  | 'provider'
  | 'heal'
  | 'incident'
  | 'deploy'
  | 'system';

export type OpsEventStatus = 'started' | 'ok' | 'error' | 'paused' | 'skipped' | 'warn';
export type OpsEventSeverity = 'info' | 'warn' | 'error' | 'critical';

export type OpsEventInput = {
  category: OpsEventCategory;
  name: string;
  status: OpsEventStatus;
  severity?: OpsEventSeverity;
  durationMs?: number | null;
  message?: string | null;
  detail?: Record<string, unknown>;
  correlationId?: string | null;
};

function defaultSeverity(status: OpsEventStatus): OpsEventSeverity {
  if (status === 'error') return 'error';
  if (status === 'warn') return 'warn';
  return 'info';
}

/** Record one operational event. Best-effort — never throws. */
export async function recordOpsEvent(input: OpsEventInput): Promise<void> {
  try {
    const supabase = createAdminSupabase();
    await supabase.from('ops_events').insert({
      category: input.category,
      name: input.name,
      status: input.status,
      severity: input.severity ?? defaultSeverity(input.status),
      duration_ms: input.durationMs ?? null,
      message: input.message ? input.message.slice(0, 500) : null,
      detail: (input.detail ?? {}) as Json,
      correlation_id: input.correlationId ?? null,
    });
  } catch {
    /* swallow — observability must never break the caller */
  }
}

/** Record one numeric metric sample. Best-effort — never throws. */
export async function recordOpsMetric(
  metric: string,
  value: number,
  labels?: Record<string, unknown>,
): Promise<void> {
  try {
    if (!Number.isFinite(value)) return;
    const supabase = createAdminSupabase();
    await supabase.from('ops_metrics').insert({
      metric,
      value,
      labels: (labels ?? {}) as Json,
    });
  } catch {
    /* swallow */
  }
}

/**
 * Time an async operation, recording a terminal `ok`/`error` event + a duration
 * metric, then returning the result (or re-throwing the original error so
 * control flow is unchanged). The terminal event is awaited so it flushes
 * before a serverless function freezes; the optional `started` event is
 * fire-and-forget.
 */
export async function withOpsSpan<T>(
  category: OpsEventCategory,
  name: string,
  fn: () => Promise<T>,
  opts?: { metric?: string; detail?: Record<string, unknown>; correlationId?: string; emitStarted?: boolean },
): Promise<T> {
  const startedAt = Date.now();
  if (opts?.emitStarted) {
    void recordOpsEvent({ category, name, status: 'started', detail: opts.detail, correlationId: opts.correlationId });
  }
  try {
    const result = await fn();
    const durationMs = Date.now() - startedAt;
    await recordOpsEvent({ category, name, status: 'ok', durationMs, detail: opts?.detail, correlationId: opts?.correlationId });
    if (opts?.metric) void recordOpsMetric(opts.metric, durationMs, { name });
    return result;
  } catch (err) {
    const durationMs = Date.now() - startedAt;
    const message = err instanceof Error ? err.message : String(err);
    await recordOpsEvent({
      category,
      name,
      status: 'error',
      severity: 'error',
      durationMs,
      message,
      detail: opts?.detail,
      correlationId: opts?.correlationId,
    });
    if (opts?.metric) void recordOpsMetric(opts.metric, durationMs, { name, error: '1' });
    throw err;
  }
}
