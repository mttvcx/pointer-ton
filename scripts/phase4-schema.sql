-- Phase 4 Pointer ù run in Supabase SQL editor before using Phase 4 features.
-- notify pgrst at end if you use PostgREST schema cache reload.

-- Wallet labels (Step 1+)
create table if not exists wallet_labels (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  wallet_address text not null,
  label text not null,
  emoji text,
  color text default 'yellow',
  created_at timestamptz default now(),
  unique(user_id, wallet_address)
);
create index if not exists wallet_labels_user_id_idx on wallet_labels(user_id);
create index if not exists wallet_labels_wallet_address_idx on wallet_labels(wallet_address);

-- Custom alert rules (Step 5); in-app audio playback (Step 6) uses payload.audio + Web Audio / HTMLAudioElement
create table if not exists alert_rules (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  name text not null,
  rule_type text not null,
  rule_config jsonb not null,
  flash_enabled boolean default true,
  flash_color text default '#7C5CFF',
  flash_size text default 'normal',
  audio_enabled boolean default false,
  audio_url text,
  audio_preset text default 'chime',
  is_active boolean default true,
  created_at timestamptz default now()
);
create index if not exists alert_rules_user_active_idx on alert_rules(user_id, is_active);

-- Step 7: Web Push fan-out when a rule matches (see emitMatchingPulseLaunchpadAlertRules).
-- PnL share cards (Step 8): POST /api/pnl-cards, public /share/[shareToken]
create table if not exists pnl_cards (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references users(id) on delete cascade,
  trade_id uuid references trades(id) on delete cascade,
  background_type text default 'plain',
  background_preset text,
  background_url text,
  card_data jsonb not null,
  share_token text unique not null,
  view_count int default 0,
  created_at timestamptz default now()
);
create index if not exists pnl_cards_share_token_idx on pnl_cards(share_token);
create index if not exists pnl_cards_user_id_idx on pnl_cards(user_id);

-- Step 9: GET /api/pnl-cards (list), portfolio Share links, OG/Twitter metadata on /share/[token]
notify pgrst, 'reload schema';
