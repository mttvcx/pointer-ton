-- Pointer Ops — observability substrate (additive, idempotent).
--
-- ops_events:  discrete operational events — cron runs, webhook deliveries,
--              trades, provider calls, self-heal actions, incidents, deploys.
-- ops_metrics: numeric time-series samples (durations, latencies, counts).
--
-- Both tables are written ONLY by the service-role emitter (lib/ops/events.ts).
-- RLS is enabled with NO policies, so the anon/public key can never read ops
-- data; the service role bypasses RLS. Nothing here is faked — rows appear only
-- when real subsystems emit them.
--
-- Retention: these tables grow with activity. A pruning cron (delete rows older
-- than N days) is a planned follow-up; until then, prune manually if needed.

create table if not exists public.ops_events (
  id             bigint generated always as identity primary key,
  ts             timestamptz not null default now(),
  category       text not null,          -- cron | webhook | trade | provider | heal | incident | deploy | system
  name           text not null,          -- e.g. discover-tokens, helius-webhook, trade-execute
  status         text not null,          -- started | ok | error | paused | skipped | warn
  severity       text not null default 'info',  -- info | warn | error | critical
  duration_ms    integer,
  message        text,                   -- short human summary (no secrets / PII)
  detail         jsonb not null default '{}'::jsonb,
  correlation_id text,
  created_at     timestamptz not null default now()
);

create index if not exists ops_events_ts_idx on public.ops_events (ts desc);
create index if not exists ops_events_category_ts_idx on public.ops_events (category, ts desc);
create index if not exists ops_events_name_ts_idx on public.ops_events (name, ts desc);
create index if not exists ops_events_errors_idx on public.ops_events (ts desc) where status = 'error';

create table if not exists public.ops_metrics (
  id         bigint generated always as identity primary key,
  ts         timestamptz not null default now(),
  metric     text not null,             -- e.g. cron.duration_ms, provider.latency_ms
  value      double precision not null,
  labels     jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ops_metrics_metric_ts_idx on public.ops_metrics (metric, ts desc);

alter table public.ops_events  enable row level security;
alter table public.ops_metrics enable row level security;
