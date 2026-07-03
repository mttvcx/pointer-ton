-- Social graph: one-way follow + mutual friend + mobile (Expo) push tokens.
-- Run in the Supabase SQL editor (or via MCP apply_migration) once the DB is restored.
-- Idempotent: safe to re-run. Ends with `notify pgrst, 'reload schema'`.

-- ─────────────────────────────────────────────────────────────
-- 1) FOLLOWS — one-way. A user follows another user, a wallet, or an X handle.
--    Wallet follows are ALSO mirrored into tracked_wallets by the app layer.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.follows (
  id            uuid primary key default gen_random_uuid(),
  follower_id   uuid not null references public.users(id) on delete cascade,
  target_type   text not null check (target_type in ('user','wallet','twitter')),
  target_ref    text not null,                    -- users.id | wallet address | lowercased handle
  created_at    timestamptz not null default now(),
  unique (follower_id, target_type, target_ref)
);
create index if not exists follows_follower_idx on public.follows (follower_id);
create index if not exists follows_target_idx   on public.follows (target_type, target_ref);

-- ─────────────────────────────────────────────────────────────
-- 2) FRIENDSHIPS — mutual, request → accept. One row per (requester, addressee) pair.
--    "Are we friends?" = a row with status='accepted' where the user is on either side.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.friendships (
  id             uuid primary key default gen_random_uuid(),
  requester_id   uuid not null references public.users(id) on delete cascade,
  addressee_id   uuid not null references public.users(id) on delete cascade,
  status         text not null default 'pending' check (status in ('pending','accepted','declined','blocked')),
  created_at     timestamptz not null default now(),
  responded_at   timestamptz,
  check (requester_id <> addressee_id),
  unique (requester_id, addressee_id)
);
create index if not exists friendships_requester_idx on public.friendships (requester_id, status);
create index if not exists friendships_addressee_idx on public.friendships (addressee_id, status);

-- ─────────────────────────────────────────────────────────────
-- 3) DEVICE PUSH TOKENS — Expo (mobile). Web push stays in push_subscriptions.
-- ─────────────────────────────────────────────────────────────
create table if not exists public.device_push_tokens (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.users(id) on delete cascade,
  expo_push_token  text not null unique,
  platform         text check (platform in ('ios','android')),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists device_push_tokens_user_idx on public.device_push_tokens (user_id);

-- ─────────────────────────────────────────────────────────────
-- RLS — enabled; the app talks through the service role (bypasses RLS).
-- Deny-by-default for anon/authenticated; add per-user policies later if you
-- ever query these tables from the client with the anon key.
-- ─────────────────────────────────────────────────────────────
alter table public.follows            enable row level security;
alter table public.friendships        enable row level security;
alter table public.device_push_tokens enable row level security;

notify pgrst, 'reload schema';
