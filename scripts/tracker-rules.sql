-- Tracker NL rules (Step 3): natural-language conditions evaluated on-chain events.
-- Apply in Supabase SQL editor or CLI; RLS can be added later (Pointer uses admin client server-side).

create table if not exists public.tracker_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  tracked_wallet_id uuid not null references public.tracked_wallets (id) on delete cascade,
  nl_text text not null,
  condition jsonb not null,
  summary text not null,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists tracker_rules_tracked_wallet_id_idx
  on public.tracker_rules (tracked_wallet_id);

create index if not exists tracker_rules_user_id_idx
  on public.tracker_rules (user_id);
