-- Twitter-first automation & trading trigger persistence (phase 2+).
-- Apply via Supabase SQL editor; orchestration validates against these rows server-side before swaps.

create table if not exists public.twitter_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users (id) on delete cascade,
  tweet_id text not null,
  author_handle text not null,
  text text not null,
  urls text[] default '{}'::text[],
  canonical_url text,
  received_at timestamptz not null default now(),
  raw_json jsonb
);

create table if not exists public.automation_global_settings (
  user_id uuid primary key references public.users (id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

create table if not exists public.automation_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  category text not null check (category in ('alert','auto_buy','auto_launch')),
  name text not null,
  enabled boolean not null default false,
  chain_hint text,
  triggers jsonb not null default '{}'::jsonb,
  execution jsonb not null default '{}'::jsonb,
  risk jsonb not null default '{}'::jsonb,
  handles text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists automation_rules_user_idx on public.automation_rules (user_id);

create table if not exists public.automation_executions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  rule_id uuid references public.automation_rules (id) on delete set null,
  twitter_event_id uuid references public.twitter_events (id) on delete set null,
  mint text,
  status text not null,
  blocked_reason text,
  tx_signature text,
  simulation boolean not null default true,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists automation_exec_user_created_idx on public.automation_executions (user_id, created_at desc);

create table if not exists public.risk_filter_results (
  id uuid primary key default gen_random_uuid(),
  execution_id uuid not null references public.automation_executions (id) on delete cascade,
  filter_key text not null,
  verdict text not null,
  severity text not null default 'warn',
  details jsonb,
  evaluated_at timestamptz not null default now()
);

create index if not exists risk_results_exec_idx on public.risk_filter_results (execution_id);
