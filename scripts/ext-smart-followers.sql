-- Smart followers — which of an account's followers are known KOLs in Pointer's
-- directory. Written by the extension as users browse followers pages (see
-- lib/ext/smartFollowers.ts → submitSmartFollowers), read back on the profile
-- hover / right-rail card (getSmartFollowers). Server-only (service role).
--
-- This table was referenced by the code but never created — without it every
-- capture upsert throws and nothing is ever stored, so smart followers always
-- read 0. Run this in the Supabase SQL editor to turn the feature on.

create table if not exists kol_smart_followers (
  handle           text        not null,
  follower_handle  text        not null,
  created_at       timestamptz not null default now(),
  primary key (handle, follower_handle)
);

-- getSmartFollowers counts + lists by handle.
create index if not exists idx_ksf_handle on kol_smart_followers (handle);

-- Server-only: all access is via the service role (createAdminSupabase), which
-- bypasses RLS. Enable RLS with no policies so nothing is publicly reachable.
alter table kol_smart_followers enable row level security;
