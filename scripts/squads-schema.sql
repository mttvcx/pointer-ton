-- Pointer Squads — run in the Supabase SQL editor to provision Phase 2.
-- Safe to re-run (idempotent). Reloads the PostgREST schema cache at the end.

create extension if not exists "uuid-ossp";

-- Squads (groups). Owner + membership tracked in squad_members.
create table if not exists squads (
  id uuid primary key default uuid_generate_v4(),
  slug text unique not null,
  name text not null,
  description text not null default '',
  chain_focus text[] not null default '{sol}',
  trading_styles text[] not null default '{trenches}',
  visibility text not null default 'private',        -- private | invite_only | request_to_join | public
  join_requirements jsonb not null default '{}'::jsonb,
  owner_user_id uuid references users(id) on delete set null,
  member_count int not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists squads_visibility_idx on squads(visibility);
create index if not exists squads_owner_idx on squads(owner_user_id);
create index if not exists squads_created_idx on squads(created_at desc);

create table if not exists squad_members (
  id uuid primary key default uuid_generate_v4(),
  squad_id uuid not null references squads(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  role text not null default 'member',               -- owner | admin | member
  status text not null default 'active',             -- active | invited | requested | left
  joined_at timestamptz not null default now(),
  unique(squad_id, user_id)
);
create index if not exists squad_members_user_idx on squad_members(user_id);
create index if not exists squad_members_squad_idx on squad_members(squad_id);
create index if not exists squad_members_status_idx on squad_members(status);

-- Keep squads.member_count in sync with active memberships.
create or replace function squads_refresh_member_count() returns trigger language plpgsql as $$
declare sid uuid;
begin
  sid := coalesce(new.squad_id, old.squad_id);
  update squads
    set member_count = (select count(*) from squad_members where squad_id = sid and status = 'active'),
        updated_at = now()
  where id = sid;
  return null;
end $$;

drop trigger if exists squad_members_count_trg on squad_members;
create trigger squad_members_count_trg
after insert or update or delete on squad_members
for each row execute function squads_refresh_member_count();

-- Server routes use the service role (bypasses RLS). Enable RLS with no public
-- policies so anon/authenticated clients can't read/write directly.
alter table squads enable row level security;
alter table squad_members enable row level security;

notify pgrst, 'reload schema';
