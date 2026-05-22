-- Helius RPC / DAS credit usage log. Run in Supabase SQL editor, then:
--   scripts/reload-postgrest-schema.sql

create table if not exists public.helius_usage (
  id uuid primary key default gen_random_uuid(),
  endpoint text not null,
  credits_estimated integer not null,
  success boolean not null,
  created_at timestamptz not null default now()
);

create index if not exists helius_usage_created_at_idx
  on public.helius_usage (created_at desc);

create index if not exists helius_usage_endpoint_created_idx
  on public.helius_usage (endpoint, created_at desc);

comment on table public.helius_usage is
  'Append-only Helius credit estimates for admin burn-rate monitoring.';
