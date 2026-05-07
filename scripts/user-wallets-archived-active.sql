-- Phase 3 Step 4: multi-wallet UI (archive + active toggle)
-- Run in Supabase SQL Editor, then run `scripts/reload-postgrest-schema.sql`.

alter table public.user_wallets
  add column if not exists is_archived boolean not null default false;

alter table public.user_wallets
  add column if not exists is_active boolean not null default true;

notify pgrst, 'reload schema';
