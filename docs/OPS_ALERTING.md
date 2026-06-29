# Ops Incident Alerting (Phase 1 · Mission 5)

Pointer already has a strong observability substrate — `ops_events` /
`ops_metrics` / `ops_incidents` (auto-opened via `ops_open_incident`), the
deterministic **Pointer Doctor** (`diagnose()`), and the `/admin/ops` dashboard.
The missing piece was **outbound** alerting: nothing pushed a notification, so
you had to be looking at the dashboard to know something broke (exactly how the
"degraded state" banner could surprise you). This adds that.

## How it works

Every `recordOpsEvent` with `status: 'error'` or `severity: 'critical'` already
auto-opens/increments an incident. At that same point it now also fires
`dispatchOpsAlert(...)` — fire-and-forget, best-effort, never throws.

- **Channels:** Discord and/or Slack via incoming webhooks (no SDK, no auth — a
  single POST each). Configure either or both:
  - `OPS_DISCORD_WEBHOOK_URL`
  - `OPS_SLACK_WEBHOOK_URL`
  - (unset = alerting silently no-ops; everything else still works.)
- **Dedup + cooldown:** one alert per incident key (`category:name`) + severity
  per window, claimed atomically in Redis (`SET NX EX`). A flapping provider
  pings **once per window**, not 100×. Windows scale by severity:
  critical **5 min**, error **15 min**, warn/info **30 min**. If Redis is down,
  an in-process fallback still prevents a flood from a single instance.
- **Content:** severity-colored Discord embed / Slack message with the incident
  key, the short message, a trimmed (secret-free) detail summary, and a deep link
  to `/admin/ops`.

## Files

- `lib/ops/alertDecisions.ts` — **pure, 9 unit tests**: `shouldDispatch`,
  `cooldownSeconds`, `alertKey`, `alertColor`, `alertTitle`, `summarizeDetail`,
  `buildAlertPayload`.
- `lib/ops/alerts.ts` — `dispatchOpsAlert` (threshold → cooldown → deliver) and
  `sendOpsAlertNow` (bypasses cooldown, used by the test endpoint). Both never
  throw and no-op when unconfigured.
- `lib/ops/events.ts` — wired at the auto-incident branch.

## Verify your wiring

`POST /api/admin/ops/test-alert` (any admin) fires a synthetic **critical** alert
to every configured channel, **bypassing the cooldown**, and returns the channels
attempted:

```json
{ "ok": true, "channels": ["discord","slack"], "configured": true }
```

`"channels": []` ⇒ neither webhook env var is set.

## Severity & PII rules

Alerts inherit the event-emitter rules: `message` is a short human summary and
`detail` is structured context — both must stay free of secrets / tokens / raw
wallets (`summarizeDetail` only trims length, it does not redact, so callers keep
detail clean, exactly as for `ops_events`).

## Remaining (tracked in PHASE1 report)

- Subsystem health signals for the new webhook **DLQ depth / retry backlog** fed
  into `diagnose()` (so a growing dead-letter queue raises a Doctor finding +
  alert), plus Redis/queue checks.
- Incident **lifecycle** in admin: operator acknowledge / resolve, root-cause
  notes, and runbook links on `ops_incidents`.
- Email channel (where appropriate) — webhook channels cover Discord/Slack today.
