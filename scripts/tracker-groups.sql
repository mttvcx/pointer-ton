-- Wallet tracker groups (starter packs + future user-created groups).
-- Apply in Supabase SQL editor, then run scripts/reload-postgrest-schema.sql.

create table if not exists public.tracker_groups (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  label text not null,
  app_chain text not null check (app_chain in ('sol', 'eth', 'bnb', 'base', 'ton')),
  is_starter boolean not null default false,
  slug text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create unique index if not exists tracker_groups_user_slug_uidx
  on public.tracker_groups (user_id, slug)
  where slug is not null;

create index if not exists tracker_groups_user_id_idx
  on public.tracker_groups (user_id);

alter table public.tracked_wallets
  add column if not exists group_id uuid references public.tracker_groups (id) on delete set null;

create index if not exists tracked_wallets_group_id_idx
  on public.tracked_wallets (group_id);

alter table public.users
  add column if not exists starter_trackers_seeded_at timestamptz;
