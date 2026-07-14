-- Account-level UI / layout preferences.
--
-- Stores a per-user JSON blob of workspace layout (docked panels, instant-trade
-- panel, pulse columns, table settings, …) so the layout follows the user across
-- devices — not just the browser that set it. Written server-side via the admin
-- (service-role) client; RLS is ON with NO public policies, so the anon/auth keys
-- can never read or write it directly (same posture as financial_accounts).
--
-- Apply once in the Supabase SQL editor, then run scripts/reload-postgrest-schema.sql
-- (or wait for the schema cache to refresh).

create table if not exists public.user_ui_prefs (
  user_id    uuid primary key references public.users(id) on delete cascade,
  prefs      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.user_ui_prefs enable row level security;

comment on table public.user_ui_prefs is
  'Per-user workspace/layout preferences (JSON). Service-role only; hydrated on login, saved debounced.';
