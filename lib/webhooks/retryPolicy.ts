/**
 * Webhook retry policy — pure decision logic (no I/O, unit-testable). The
 * durable queue/DLQ I/O lives in `queue.ts`.
 *
 * A webhook job that fails processing is retried with capped exponential
 * backoff. After `maxAttempts` it is dead-lettered for manual inspection/replay.
 */

export type WebhookRetryConfig = {
  /** Total processing attempts before dead-lettering (incl. the first). */
  maxAttempts: number;
  /** Base backoff in ms for the first retry. */
  baseMs: number;
  /** Hard cap on a single backoff delay. */
  maxMs: number;
};

export const DEFAULT_WEBHOOK_RETRY: WebhookRetryConfig = {
  maxAttempts: 6,
  baseMs: 5_000, // 5s
  maxMs: 15 * 60_000, // 15m
};

/**
 * Backoff for the retry that follows attempt number `attempt` (1-based: the 1st
 * processing attempt failing schedules with `attempt=1`). Exponential
 * (base * 2^(attempt-1)) capped at maxMs, with deterministic ±12.5% jitter
 * derived from `jitter01` (a caller-supplied value in [0,1), e.g. hashed jobId)
 * so retries don't thunder. No Math.random — keeps this pure/replayable.
 */
export function backoffMs(
  attempt: number,
  cfg: WebhookRetryConfig = DEFAULT_WEBHOOK_RETRY,
  jitter01 = 0.5,
): number {
  const a = Math.max(1, Math.floor(attempt));
  const raw = cfg.baseMs * 2 ** (a - 1);
  const capped = Math.min(raw, cfg.maxMs);
  const j = Math.min(0.999999, Math.max(0, jitter01));
  const factor = 0.875 + j * 0.25; // [0.875, 1.125)
  return Math.round(capped * factor);
}

export type RetryDecision =
  | { action: 'retry'; attempt: number; delayMs: number; dueAtMs: number }
  | { action: 'dead'; attempt: number };

/**
 * Decide what to do after a processing attempt failed. `attempt` is the number
 * of attempts made so far (1 after the first failure). When attempts are
 * exhausted → dead-letter; otherwise schedule the next retry.
 */
export function decideRetry(
  attempt: number,
  nowMs: number,
  cfg: WebhookRetryConfig = DEFAULT_WEBHOOK_RETRY,
  jitter01 = 0.5,
): RetryDecision {
  const a = Math.max(1, Math.floor(attempt));
  if (a >= cfg.maxAttempts) return { action: 'dead', attempt: a };
  const delayMs = backoffMs(a, cfg, jitter01);
  return { action: 'retry', attempt: a, delayMs, dueAtMs: nowMs + delayMs };
}

/** Stable [0,1) jitter from a job id so the same job always jitters the same. */
export function jitterFromId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // unsigned → [0,1)
  return ((h >>> 0) % 100000) / 100000;
}
