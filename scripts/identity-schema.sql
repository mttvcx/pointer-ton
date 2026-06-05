-- Pointer identity graph (optional Supabase persistence — v1 uses in-repo JSON seeds + runtime registry).
-- Run in SQL editor, then: notify pgrst, 'reload schema';

create table if not exists identity_profiles (
  id uuid primary key default uuid_generate_v4(),
  display_name text not null,
  normalized_display_name text not null,
  avatar_url text,
  twitter_handle text,
  telegram_handle text,
  website_url text,
  notes text,
  primary_category text not null default 'kol',
  badges jsonb not null default '[]'::jsonb,
  verified boolean not null default false,
  source_priority int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists identity_wallets (
  id uuid primary key default uuid_generate_v4(),
  identity_id uuid not null references identity_profiles(id) on delete cascade,
  chain text not null check (chain in ('sol', 'eth', 'bnb', 'base', 'ton')),
  address text not null,
  normalized_address text not null,
  address_type text not null check (address_type in ('solana', 'evm')),
  label text,
  source text not null,
  source_url text,
  confidence real not null default 0.75,
  verified boolean not null default false,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (chain, normalized_address)
);

create index if not exists identity_wallets_chain_norm_idx on identity_wallets(chain, normalized_address);

notify pgrst, 'reload schema';
