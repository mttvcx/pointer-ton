-- Smart followers — which of an account's followers are known KOLs in Pointer's
-- directory. Written by the extension as users browse followers pages (see
-- lib/ext/smartFollowers.ts → submitSmartFollowers), read back on the profile
-- hover / right-rail card (getSmartFollowers). Server-only (service role).
--
-- NOTE: this table already exists in prod (created ad-hoc, ~230 rows). This file
-- is the tracked definition so it's reproducible on a fresh database. It is
-- idempotent (IF NOT EXISTS) — safe to run, a no-op where the table is present.

create table if not exists kol_smart_followers (
  handle           text        not null,
  follower_handle  text        not null,
  first_seen       timestamptz not null default now(),
  primary key (handle, follower_handle)
);

-- getSmartFollowers counts + lists by handle.
create index if not exists idx_ksf_handle on kol_smart_followers (handle);

-- Server-only: all access is via the service role (createAdminSupabase), which
-- bypasses RLS. Enable RLS with no policies so nothing is publicly reachable.
alter table kol_smart_followers enable row level security;
