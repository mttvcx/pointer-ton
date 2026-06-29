# Webhook Infrastructure (Phase 1 · Mission 2)

Production-grade inbound webhook handling. Pointer has one inbound webhook today
(Helius enhanced transactions) but the framework is provider-generic so adding
more is trivial.

## Design contract

1. **Authenticate** the sender (constant-time bearer compare).
2. **Respect read-only / maintenance** — ACK 200 without processing (a non-200
   triggers provider retry storms; we shed load deliberately).
3. **Idempotency claim** — durable 24h `SET NX` on the event signature
   (`lib/webhooks/idempotency.ts`), replacing the old 60s window. Fails OPEN
   (a duplicate is cheaper than a dropped event; downstream writes are also
   idempotent — mint upsert, swap composite-key dedup).
4. **ACK immediately**, then process out of band with `after()`. The heavy work
   (token upserts, alerts, swap indexing) never blocks the response.
5. **Retry + dead-letter** on failure (see below).
6. **Metrics** on every step.

## Retry / DLQ (`lib/webhooks/*`)

- `retryPolicy.ts` — **pure, unit-tested** decisions: capped exponential backoff
  (`baseMs·2^(n-1)`, capped at `maxMs`) with deterministic ±12.5% jitter derived
  from the job id (no `Math.random`, so it's replayable). After `maxAttempts`
  (default 6) the job is dead-lettered. Defaults: base 5s, cap 15m.
- `queue.ts` — durable I/O over Redis:
  - **delay queue**: ZSET `wh:retry:{provider}` scored by due-time; job blob in
    `wh:job:{provider}:{id}` (7d TTL).
  - **dead-letter queue**: list `wh:dlq:{provider}` (soft cap 1000, oldest
    dropped); `peekDeadLetters` / `replayDeadLetters` for inspection + manual
    requeue.
- `runner.ts` — `runWebhookJob(job, processor)`: runs the processor; on success
  clears the job + records `webhook.process.ms{status=ok}`; on failure the pure
  policy reschedules (backoff) or dead-letters, recording an ops event each way.
  Never throws.
- `registry.ts` — `provider → processor` map. Processors MUST be idempotent (they
  can run again on retry/replay).
- `drain.ts` + `/api/cron/drain-webhooks` (every 2 min) — the durability backstop:
  drains due retries, dead-letters the exhausted, and records `webhook.retry.depth`
  / `webhook.dlq.depth` gauges so the ops dashboard can alert on a growing
  backlog. Pauses under read-only like every other cron.

## Failure flow

```
Helius POST ──auth──readonly?──claim(24h)──┐ dup → 200 {deduped}
                                           │
                          200 {accepted}◄──┤  (immediate ACK)
                                           │
                              after() ── runWebhookJob ── processor
                                           │                   │ ok → clear
                                           │                   │ fail
                                           ▼                   ▼
                                   metrics + ops event   decideRetry()
                                                          ├ retry → ZSET (backoff)
                                                          └ dead  → DLQ
                                                               ▲
                          /api/cron/drain-webhooks (2m) ───────┘ retries due jobs,
                                                                 dead-letters exhausted
```

## Idempotency & replay safety

- The 24h claim + idempotent downstream writes mean the same signature processed
  twice (retry, replay, provider re-delivery) is safe.
- Dead-lettered jobs are inspectable and **replayable** (`replayDeadLetters`)
  after a fix ships — no event is silently lost once it has been claimed.
- Tradeoff (documented): the happy path is NOT pre-persisted to Redis before
  `after()` runs — only failures persist. This keeps Redis writes low for a
  high-volume firehose (Helius). `after()` on Fluid Compute is reliable; the
  residual loss window is a crash between ACK and the first processing attempt,
  which the provider's own re-delivery + downstream idempotency largely cover. If
  stricter durability is ever required, pre-persist on receipt (one extra ZADD)
  and let the drain cron own the first attempt.

## Observability

Metrics (→ `ops_metrics`): `webhook.received`, `webhook.deduped`,
`webhook.process.ms{provider,status}`, `webhook.retry.depth{provider}`,
`webhook.dlq.depth{provider}`. Events (→ `ops_events`, auto-incident on error):
`{provider}:processed`, `{provider}:retry_scheduled`, `{provider}:dead_letter`.

## Tests

`lib/webhooks/retryPolicy.test.ts` — 11 cases: exponential growth, cap, jitter
bounds, retry-vs-dead-letter thresholds, deterministic jitter. The Redis I/O is
covered by tsc + build + the InMemory shim (list/zset ops added to `RedisLike`).

## Remaining (tracked in PHASE1 report)

- Admin webhook-health dashboard (DLQ depth + contents + one-click replay) — built
  alongside the unified ops/incident dashboard in Mission 5.
- Per-attempt delivery history table (currently per-event ops_events + metrics).
