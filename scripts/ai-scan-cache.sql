-- Shared AI scan cache (global across users). Run in Supabase SQL editor, then:
--   scripts/reload-postgrest-schema.sql

create table if not exists public.ai_scan_cache (
  cache_key text primary key,
  result jsonb not null,
  model_used text not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  hit_count integer not null default 0,
  source_mint text,
  source_wallet text,
  mc_at_scan numeric,
  scan_type text not null
);

create index if not exists ai_scan_cache_expires_at_idx
  on public.ai_scan_cache (expires_at);

create index if not exists ai_scan_cache_scan_type_created_idx
  on public.ai_scan_cache (scan_type, created_at desc);

create index if not exists ai_scan_cache_hit_count_created_idx
  on public.ai_scan_cache (created_at desc, hit_count desc);

comment on table public.ai_scan_cache is
  'Global AI response cache. Keys are public-data only (no user positions).';

-- Increment hit_count atomically; returns new count or null if missing/expired.
create or replace function public.increment_ai_scan_cache_hit(p_cache_key text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  update public.ai_scan_cache
  set hit_count = hit_count + 1
  where cache_key = p_cache_key
    and expires_at > now()
  returning hit_count into v_count;
  return v_count;
end;
$$;
